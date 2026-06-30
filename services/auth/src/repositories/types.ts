/**
 * Repository abstractions for the Auth Service.
 *
 * The service layer depends only on these interfaces so its logic (registration, login, lockout,
 * rotation, suspension, auditing) can be property-tested against in-memory fakes without a live
 * Postgres, while production wires the `pg`-backed implementations.
 */

import type { AccountStatus, Language, Role } from '../domain/roles.js';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  businessName: string;
  role: Role;
  status: AccountStatus;
  preferredLanguage: Language;
  /** Epoch ms until which the account is locked, or null. */
  lockedUntil: number | null;
  createdAt: number;
}

export interface NewUser {
  email: string;
  passwordHash: string;
  businessName: string;
  role: Role;
  status: AccountStatus;
  preferredLanguage: Language;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  revoked: boolean;
  expiresAt: number;
  createdAt: number;
}

export interface LoginAttemptRecord {
  id: string;
  userId: string;
  success: boolean;
  attemptedAt: number;
}

export interface AuditLogRecord {
  id: string;
  userId: string | null;
  eventType: string;
  detail: Record<string, unknown> | null;
  createdAt: number;
}

export interface UserRepository {
  findById(id: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  create(user: NewUser): Promise<UserRecord>;
  updateStatus(id: string, status: AccountStatus): Promise<void>;
  setLockedUntil(id: string, lockedUntil: number | null): Promise<void>;
}

export interface RefreshTokenRepository {
  create(token: Omit<RefreshTokenRecord, 'id' | 'createdAt'>): Promise<RefreshTokenRecord>;
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revoke(id: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<number>;
}

export interface LoginAttemptRepository {
  record(userId: string, success: boolean, attemptedAt: number): Promise<void>;
  /** Recent attempts for an account, used to evaluate the lockout window (Req 1.7). */
  recentForUser(userId: string, sinceEpochMs: number): Promise<LoginAttemptRecord[]>;
}

export interface AuditLogRepository {
  append(
    userId: string | null,
    eventType: string,
    detail: Record<string, unknown> | null,
    createdAt: number,
  ): Promise<AuditLogRecord>;
  /** Read-only accessor (no update/delete) — audit rows are immutable (Req 19.5). */
  listForUser(userId: string): Promise<AuditLogRecord[]>;
}

export interface Repositories {
  users: UserRepository;
  refreshTokens: RefreshTokenRepository;
  loginAttempts: LoginAttemptRepository;
  auditLog: AuditLogRepository;
}
