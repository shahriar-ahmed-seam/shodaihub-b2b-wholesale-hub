/**
 * Postgres-backed repository implementations (`pg` driver).
 *
 * Mirror the semantics of the in-memory fakes. Timestamps are stored as `TIMESTAMPTZ` and surfaced
 * to the domain as epoch milliseconds. All statements are parameterized (Req 19.3).
 */

import type pg from 'pg';
import type { AccountStatus, Language, Role } from '../domain/roles.js';
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

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  business_name: string;
  role: Role;
  status: AccountStatus;
  preferred_language: Language;
  locked_until: Date | null;
  created_at: Date;
}

function mapUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    businessName: row.business_name,
    role: row.role,
    status: row.status,
    preferredLanguage: row.preferred_language,
    lockedUntil: row.locked_until ? row.locked_until.getTime() : null,
    createdAt: row.created_at.getTime(),
  };
}

export class PgUserRepository implements UserRepository {
  constructor(private readonly pool: pg.Pool) {}

  async findById(id: string): Promise<UserRecord | null> {
    const { rows } = await this.pool.query<UserRow>('SELECT * FROM auth.users WHERE id = $1', [id]);
    return rows[0] ? mapUser(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const { rows } = await this.pool.query<UserRow>(
      'SELECT * FROM auth.users WHERE lower(email) = lower($1)',
      [email],
    );
    return rows[0] ? mapUser(rows[0]) : null;
  }

  async create(user: NewUser): Promise<UserRecord> {
    const { rows } = await this.pool.query<UserRow>(
      `INSERT INTO auth.users (email, password_hash, business_name, role, status, preferred_language)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [user.email, user.passwordHash, user.businessName, user.role, user.status, user.preferredLanguage],
    );
    return mapUser(rows[0]!);
  }

  async updateStatus(id: string, status: AccountStatus): Promise<void> {
    await this.pool.query('UPDATE auth.users SET status = $2 WHERE id = $1', [id, status]);
  }

  async setLockedUntil(id: string, lockedUntil: number | null): Promise<void> {
    const ts = lockedUntil === null ? null : new Date(lockedUntil);
    // Reflect lock state in status: ACTIVE → LOCKED when locking; LOCKED → ACTIVE when clearing.
    await this.pool.query(
      `UPDATE auth.users
         SET locked_until = $2,
             status = CASE
               WHEN $2 IS NOT NULL AND status = 'ACTIVE' THEN 'LOCKED'
               WHEN $2 IS NULL AND status = 'LOCKED' THEN 'ACTIVE'
               ELSE status
             END
       WHERE id = $1`,
      [id, ts],
    );
  }
}

interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  revoked: boolean;
  expires_at: Date;
  created_at: Date;
}

function mapRefresh(row: RefreshTokenRow): RefreshTokenRecord {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    revoked: row.revoked,
    expiresAt: row.expires_at.getTime(),
    createdAt: row.created_at.getTime(),
  };
}

export class PgRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly pool: pg.Pool) {}

  async create(token: Omit<RefreshTokenRecord, 'id' | 'createdAt'>): Promise<RefreshTokenRecord> {
    const { rows } = await this.pool.query<RefreshTokenRow>(
      `INSERT INTO auth.refresh_tokens (user_id, token_hash, revoked, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [token.userId, token.tokenHash, token.revoked, new Date(token.expiresAt)],
    );
    return mapRefresh(rows[0]!);
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const { rows } = await this.pool.query<RefreshTokenRow>(
      'SELECT * FROM auth.refresh_tokens WHERE token_hash = $1',
      [tokenHash],
    );
    return rows[0] ? mapRefresh(rows[0]) : null;
  }

  async revoke(id: string): Promise<void> {
    await this.pool.query('UPDATE auth.refresh_tokens SET revoked = TRUE WHERE id = $1', [id]);
  }

  async revokeAllForUser(userId: string): Promise<number> {
    const { rowCount } = await this.pool.query(
      'UPDATE auth.refresh_tokens SET revoked = TRUE WHERE user_id = $1 AND revoked = FALSE',
      [userId],
    );
    return rowCount ?? 0;
  }
}

interface LoginAttemptRow {
  id: string;
  user_id: string;
  success: boolean;
  attempted_at: Date;
}

export class PgLoginAttemptRepository implements LoginAttemptRepository {
  constructor(private readonly pool: pg.Pool) {}

  async record(userId: string, success: boolean, attemptedAt: number): Promise<void> {
    await this.pool.query(
      'INSERT INTO auth.login_attempts (user_id, success, attempted_at) VALUES ($1, $2, $3)',
      [userId, success, new Date(attemptedAt)],
    );
  }

  async recentForUser(userId: string, sinceEpochMs: number): Promise<LoginAttemptRecord[]> {
    const { rows } = await this.pool.query<LoginAttemptRow>(
      `SELECT * FROM auth.login_attempts
        WHERE user_id = $1 AND attempted_at >= $2
        ORDER BY attempted_at ASC`,
      [userId, new Date(sinceEpochMs)],
    );
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      success: r.success,
      attemptedAt: r.attempted_at.getTime(),
    }));
  }
}

interface AuditLogRow {
  id: string;
  user_id: string | null;
  event_type: string;
  detail: Record<string, unknown> | null;
  created_at: Date;
}

export class PgAuditLogRepository implements AuditLogRepository {
  constructor(private readonly pool: pg.Pool) {}

  async append(
    userId: string | null,
    eventType: string,
    detail: Record<string, unknown> | null,
    createdAt: number,
  ): Promise<AuditLogRecord> {
    const { rows } = await this.pool.query<AuditLogRow>(
      `INSERT INTO auth.audit_log (user_id, event_type, detail, created_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, eventType, detail, new Date(createdAt)],
    );
    const row = rows[0]!;
    return {
      id: row.id,
      userId: row.user_id,
      eventType: row.event_type,
      detail: row.detail,
      createdAt: row.created_at.getTime(),
    };
  }

  async listForUser(userId: string): Promise<AuditLogRecord[]> {
    const { rows } = await this.pool.query<AuditLogRow>(
      'SELECT * FROM auth.audit_log WHERE user_id = $1 ORDER BY created_at ASC',
      [userId],
    );
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      eventType: row.event_type,
      detail: row.detail,
      createdAt: row.created_at.getTime(),
    }));
  }
}

export function createPgRepositories(pool: pg.Pool): Repositories {
  return {
    users: new PgUserRepository(pool),
    refreshTokens: new PgRefreshTokenRepository(pool),
    loginAttempts: new PgLoginAttemptRepository(pool),
    auditLog: new PgAuditLogRepository(pool),
  };
}
