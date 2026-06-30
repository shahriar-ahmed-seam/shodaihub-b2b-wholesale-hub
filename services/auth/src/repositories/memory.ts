/**
 * In-memory repository implementations.
 *
 * Used by the automated test-suite (and as a fallback when no Postgres is reachable) so that the
 * full service behaviour can be exercised — including the property-based suites — without a live
 * database. Semantics mirror the `pg`-backed implementations.
 */

import { randomUUID } from 'node:crypto';
import type { AccountStatus } from '../domain/roles.js';
import type {
  AuditLogRecord,
  AuditLogRepository,
  LoginAttemptRecord,
  LoginAttemptRepository,
  NewUser,
  RefreshTokenRecord,
  RefreshTokenRepository,
  Repositories,
  UserRecord,
  UserRepository,
} from './types.js';

export class InMemoryUserRepository implements UserRepository {
  private readonly byId = new Map<string, UserRecord>();
  private readonly byEmail = new Map<string, string>();

  async findById(id: string): Promise<UserRecord | null> {
    return this.byId.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const id = this.byEmail.get(email.toLowerCase());
    return id ? (this.byId.get(id) ?? null) : null;
  }

  async create(user: NewUser): Promise<UserRecord> {
    const record: UserRecord = {
      id: randomUUID(),
      email: user.email,
      passwordHash: user.passwordHash,
      businessName: user.businessName,
      role: user.role,
      status: user.status,
      preferredLanguage: user.preferredLanguage,
      lockedUntil: null,
      createdAt: Date.now(),
    };
    this.byId.set(record.id, record);
    this.byEmail.set(record.email.toLowerCase(), record.id);
    return { ...record };
  }

  async updateStatus(id: string, status: AccountStatus): Promise<void> {
    const record = this.byId.get(id);
    if (record) record.status = status;
  }

  /** Test accessor: total number of stored users. */
  size(): number {
    return this.byId.size;
  }

  async setLockedUntil(id: string, lockedUntil: number | null): Promise<void> {
    const record = this.byId.get(id);
    if (record) {
      record.lockedUntil = lockedUntil;
      if (lockedUntil !== null && record.status === 'ACTIVE') {
        record.status = 'LOCKED';
      } else if (lockedUntil === null && record.status === 'LOCKED') {
        record.status = 'ACTIVE';
      }
    }
  }
}

export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  private readonly byId = new Map<string, RefreshTokenRecord>();

  async create(token: Omit<RefreshTokenRecord, 'id' | 'createdAt'>): Promise<RefreshTokenRecord> {
    const record: RefreshTokenRecord = { id: randomUUID(), createdAt: Date.now(), ...token };
    this.byId.set(record.id, record);
    return { ...record };
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    for (const record of this.byId.values()) {
      if (record.tokenHash === tokenHash) return { ...record };
    }
    return null;
  }

  async revoke(id: string): Promise<void> {
    const record = this.byId.get(id);
    if (record) record.revoked = true;
  }

  async revokeAllForUser(userId: string): Promise<number> {
    let count = 0;
    for (const record of this.byId.values()) {
      if (record.userId === userId && !record.revoked) {
        record.revoked = true;
        count += 1;
      }
    }
    return count;
  }
}

export class InMemoryLoginAttemptRepository implements LoginAttemptRepository {
  private readonly attempts: LoginAttemptRecord[] = [];

  async record(userId: string, success: boolean, attemptedAt: number): Promise<void> {
    this.attempts.push({ id: randomUUID(), userId, success, attemptedAt });
  }

  async recentForUser(userId: string, sinceEpochMs: number): Promise<LoginAttemptRecord[]> {
    return this.attempts
      .filter((a) => a.userId === userId && a.attemptedAt >= sinceEpochMs)
      .map((a) => ({ ...a }));
  }
}

export class InMemoryAuditLogRepository implements AuditLogRepository {
  private readonly entries: AuditLogRecord[] = [];

  async append(
    userId: string | null,
    eventType: string,
    detail: Record<string, unknown> | null,
    createdAt: number,
  ): Promise<AuditLogRecord> {
    const record: AuditLogRecord = { id: randomUUID(), userId, eventType, detail, createdAt };
    // Push a frozen copy: audit rows are immutable (Req 19.5).
    this.entries.push(Object.freeze({ ...record }));
    return { ...record };
  }

  async listForUser(userId: string): Promise<AuditLogRecord[]> {
    return this.entries.filter((e) => e.userId === userId).map((e) => ({ ...e }));
  }

  /** Test/diagnostic helper: full immutable log. */
  async listAll(): Promise<AuditLogRecord[]> {
    return this.entries.map((e) => ({ ...e }));
  }
}

export function createInMemoryRepositories(): Repositories & {
  auditLog: InMemoryAuditLogRepository;
} {
  return {
    users: new InMemoryUserRepository(),
    refreshTokens: new InMemoryRefreshTokenRepository(),
    loginAttempts: new InMemoryLoginAttemptRepository(),
    auditLog: new InMemoryAuditLogRepository(),
  };
}
