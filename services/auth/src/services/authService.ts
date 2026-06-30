/**
 * Auth Service application logic (Req 1, 2, 16.2, 16.3, 19.1, 19.5).
 *
 * Pure-ish orchestration over injected repositories, a {@link PasswordHasher}, a {@link TokenService},
 * and a {@link Clock}. No Express/HTTP concerns leak in here; failures are raised as {@link AppError}
 * so routes render the shared error envelope. This separation lets every behaviour be exercised by
 * the property-based suites against in-memory fakes (no live Postgres required).
 */

import { AppError, Errors } from '@b2b/shared-node';
import { evaluateLockout, type LockoutPolicy } from '../domain/lockout.js';
import type { PasswordHasher } from '../domain/password.js';
import type { AccountStatus, Language, Role } from '../domain/roles.js';
import {
  generateRefreshToken,
  hashRefreshToken,
  type TokenService,
} from '../domain/tokens.js';
import { validateRegistration, type RegistrationInput } from '../domain/validation.js';
import type { Repositories, UserRecord } from '../repositories/types.js';
import { systemClock, type Clock } from './clock.js';
import { AuthEvent } from './events.js';

export interface AuthServiceDeps {
  repositories: Repositories;
  passwordHasher: PasswordHasher;
  tokens: TokenService;
  clock?: Clock;
  lockoutPolicy: LockoutPolicy;
  refreshTtlDays: number;
}

export interface PublicUser {
  id: string;
  email: string;
  businessName: string;
  role: Role;
  status: AccountStatus;
  preferredLanguage: Language;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult extends TokenPair {
  user: PublicUser;
}

const GENERIC_AUTH_FAILURE = 'Invalid email or password';
const ACCOUNT_LOCKED_MESSAGE =
  'Account is temporarily locked due to repeated failed login attempts. Try again later.';
const ACCOUNT_SUSPENDED_MESSAGE = 'This account has been suspended.';

function toPublicUser(u: UserRecord): PublicUser {
  return {
    id: u.id,
    email: u.email,
    businessName: u.businessName,
    role: u.role,
    status: u.status,
    preferredLanguage: u.preferredLanguage,
  };
}

export class AuthService {
  private readonly repos: Repositories;
  private readonly hasher: PasswordHasher;
  private readonly tokens: TokenService;
  private readonly clock: Clock;
  private readonly policy: LockoutPolicy;
  private readonly refreshTtlMs: number;

  constructor(deps: AuthServiceDeps) {
    this.repos = deps.repositories;
    this.hasher = deps.passwordHasher;
    this.tokens = deps.tokens;
    this.clock = deps.clock ?? systemClock;
    this.policy = deps.lockoutPolicy;
    this.refreshTtlMs = deps.refreshTtlDays * 24 * 60 * 60 * 1000;
  }

  // ── Registration (Req 1.1, 1.2, 1.3, 1.8, 2.5) ───────────────────────────────────────────────

  async register(input: RegistrationInput): Promise<PublicUser> {
    const result = validateRegistration(input);
    if (!result.ok) {
      const isPasswordPolicy = result.errors.some((e) => e.field === 'password');
      const code = isPasswordPolicy ? 'PASSWORD_POLICY' : 'VALIDATION_ERROR';
      const details = result.errors.map((e) => ({ field: e.field, issue: e.issue }));
      throw Errors.validation(code, 'Registration request failed validation', details);
    }

    const { email, password, businessName, role, preferredLanguage } = result.value;

    const existing = await this.repos.users.findByEmail(email);
    if (existing) {
      throw Errors.conflict('EMAIL_ALREADY_REGISTERED', 'The email is already registered');
    }

    const passwordHash = await this.hasher.hash(password);
    const user = await this.repos.users.create({
      email,
      passwordHash,
      businessName,
      role,
      status: 'PENDING_VERIFICATION',
      preferredLanguage,
    });

    await this.audit(user.id, AuthEvent.USER_REGISTERED, { role, email });
    return toPublicUser(user);
  }

  // ── Login (Req 1.4, 1.5, 1.7, 1.10, 16.3) ────────────────────────────────────────────────────

  async login(emailRaw: string, password: string): Promise<LoginResult> {
    const email = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : '';
    const now = this.clock.now();
    const user = await this.repos.users.findByEmail(email);

    if (!user) {
      // Unknown account: do not reveal which credential was wrong (Req 1.5).
      await this.audit(null, AuthEvent.LOGIN_FAILURE, { email, reason: 'unknown_account' });
      throw Errors.unauthorized('AUTH_FAILED', GENERIC_AUTH_FAILURE);
    }

    // Non-active accounts reject ALL authentication, even with correct credentials (Req 1.10, 16.3).
    const lockState = await this.currentLockState(user, now);
    if (lockState.locked) {
      await this.audit(user.id, AuthEvent.AUTH_REJECTED_LOCKED, { lockedUntil: lockState.lockedUntil });
      throw Errors.locked('ACCOUNT_LOCKED', ACCOUNT_LOCKED_MESSAGE);
    }
    if (user.status === 'SUSPENDED') {
      await this.audit(user.id, AuthEvent.AUTH_REJECTED_SUSPENDED, {});
      throw Errors.unauthorized('ACCOUNT_SUSPENDED', ACCOUNT_SUSPENDED_MESSAGE);
    }
    if (user.status === 'PENDING_VERIFICATION') {
      await this.audit(user.id, AuthEvent.AUTH_REJECTED_INACTIVE, { status: user.status });
      throw Errors.unauthorized('AUTH_FAILED', GENERIC_AUTH_FAILURE);
    }

    const passwordOk = await this.hasher.verify(user.passwordHash, password);
    await this.repos.loginAttempts.record(user.id, passwordOk, now);

    if (!passwordOk) {
      // Re-evaluate lockout including this failure (Req 1.7).
      const after = await this.computeLock(user.id, now);
      if (after.lockedUntil !== null && now < after.lockedUntil) {
        await this.repos.users.setLockedUntil(user.id, after.lockedUntil);
        await this.audit(user.id, AuthEvent.ACCOUNT_LOCKED, { lockedUntil: after.lockedUntil });
        throw Errors.locked('ACCOUNT_LOCKED', ACCOUNT_LOCKED_MESSAGE);
      }
      await this.audit(user.id, AuthEvent.LOGIN_FAILURE, { reason: 'bad_password' });
      throw Errors.unauthorized('AUTH_FAILED', GENERIC_AUTH_FAILURE);
    }

    // Successful login: clear any expired lock flag and issue tokens (Req 1.4).
    if (user.status === 'LOCKED') {
      await this.repos.users.setLockedUntil(user.id, null);
    }
    const pair = await this.issueTokenPair(user.id, user.role, now);
    await this.audit(user.id, AuthEvent.LOGIN_SUCCESS, {});
    return { ...pair, user: toPublicUser(user) };
  }

  // ── Refresh rotation (Req 1.6, 1.9) ──────────────────────────────────────────────────────────

  async refresh(refreshToken: string): Promise<TokenPair> {
    const now = this.clock.now();
    const tokenHash = hashRefreshToken(String(refreshToken ?? ''));
    const record = await this.repos.refreshTokens.findByHash(tokenHash);

    if (!record || record.revoked || record.expiresAt <= now) {
      await this.audit(record?.userId ?? null, AuthEvent.REFRESH_REJECTED, {
        reason: !record ? 'not_found' : record.revoked ? 'revoked' : 'expired',
      });
      throw Errors.unauthorized('INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired');
    }

    const user = await this.repos.users.findById(record.userId);
    if (!user || user.status === 'SUSPENDED') {
      await this.audit(record.userId, AuthEvent.REFRESH_REJECTED, { reason: 'account_unavailable' });
      throw Errors.unauthorized('INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired');
    }

    // Rotate: revoke the presented token, then issue a fresh pair (Req 1.6).
    await this.repos.refreshTokens.revoke(record.id);
    const pair = await this.issueTokenPair(user.id, user.role, now);
    await this.audit(user.id, AuthEvent.TOKEN_REFRESHED, {});
    return pair;
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashRefreshToken(String(refreshToken ?? ''));
    const record = await this.repos.refreshTokens.findByHash(tokenHash);
    if (record && !record.revoked) {
      await this.repos.refreshTokens.revoke(record.id);
    }
    await this.audit(record?.userId ?? null, AuthEvent.LOGOUT, {});
  }

  // ── Admin suspension (Req 16.2) ──────────────────────────────────────────────────────────────

  async suspendUser(targetUserId: string): Promise<PublicUser> {
    const user = await this.repos.users.findById(targetUserId);
    if (!user) {
      throw Errors.notFound('USER_NOT_FOUND', 'User not found');
    }
    await this.repos.users.updateStatus(targetUserId, 'SUSPENDED');
    const revoked = await this.repos.refreshTokens.revokeAllForUser(targetUserId);
    await this.audit(targetUserId, AuthEvent.ACCOUNT_SUSPENDED, { revokedSessions: revoked });
    const updated = await this.repos.users.findById(targetUserId);
    return toPublicUser(updated ?? { ...user, status: 'SUSPENDED' });
  }

  // ── Profile (Req 2.1) ────────────────────────────────────────────────────────────────────────

  async me(userId: string): Promise<PublicUser> {
    const user = await this.repos.users.findById(userId);
    if (!user) {
      throw Errors.unauthorized('AUTH_FAILED', 'Account not found');
    }
    return toPublicUser(user);
  }

  /** Record an access-control decision for a protected resource (Req 19.5, Property 40). */
  async recordAccessDecision(userId: string, granted: boolean, detail: Record<string, unknown> = {}): Promise<void> {
    await this.audit(userId, granted ? AuthEvent.ACCESS_GRANTED : AuthEvent.ACCESS_DENIED, detail);
  }

  // ── Internals ────────────────────────────────────────────────────────────────────────────────

  private async issueTokenPair(userId: string, role: Role, now: number): Promise<TokenPair> {
    const accessToken = this.tokens.issueAccessToken(userId, role);
    const refreshToken = generateRefreshToken();
    await this.repos.refreshTokens.create({
      userId,
      tokenHash: hashRefreshToken(refreshToken),
      revoked: false,
      expiresAt: now + this.refreshTtlMs,
    });
    return { accessToken, refreshToken };
  }

  private async computeLock(userId: string, now: number): Promise<{ lockedUntil: number | null }> {
    const since = now - this.policy.windowMs;
    const attempts = await this.repos.loginAttempts.recentForUser(userId, since);
    const { lockedUntil } = evaluateLockout(
      attempts.map((a) => ({ success: a.success, attemptedAt: a.attemptedAt })),
      now,
      null,
      this.policy,
    );
    return { lockedUntil };
  }

  private async currentLockState(
    user: UserRecord,
    now: number,
  ): Promise<{ locked: boolean; lockedUntil: number | null }> {
    const since = now - this.policy.windowMs;
    const attempts = await this.repos.loginAttempts.recentForUser(user.id, since);
    return evaluateLockout(
      attempts.map((a) => ({ success: a.success, attemptedAt: a.attemptedAt })),
      now,
      user.lockedUntil,
      this.policy,
    );
  }

  private async audit(
    userId: string | null,
    eventType: string,
    detail: Record<string, unknown>,
  ): Promise<void> {
    await this.repos.auditLog.append(userId, eventType, detail, this.clock.now());
  }
}

export { AppError };
