/**
 * Environment-driven configuration for the Auth Service.
 *
 * All values come from environment variables (Req 20.4). Sensible local-dev defaults are
 * provided so the service and its test-suite can run without a populated `.env`.
 */

export interface AuthConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  logLevel: string;
  /** Access (JWT) token lifetime in minutes — design fixes this at 60 (Req 1.4). */
  accessTokenTtlMinutes: number;
  /** Refresh token lifetime in days — design fixes this at 7 (Req 1.4). */
  refreshTokenTtlDays: number;
  /** Number of consecutive failures inside the window that triggers a lockout (Req 1.7). */
  lockoutThreshold: number;
  /** Rolling window (minutes) within which the failures must occur, and lock duration (Req 1.7). */
  lockoutWindowMinutes: number;
  /** RS256 PEM keys (may be empty → an ephemeral keypair is generated for local/test). */
  jwtPrivateKey: string;
  jwtPublicKey: string;
}

/** Normalize PEM material that arrives with literal `\n` sequences (common in env vars). */
function normalizePem(value: string | undefined): string {
  if (!value) return '';
  return value.includes('\\n') ? value.replace(/\\n/g, '\n') : value;
}

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    port: intFromEnv('AUTH_PORT', 3001),
    databaseUrl:
      env.AUTH_DB_URL ?? 'postgres://auth:auth_local_pw@localhost:5432/auth',
    logLevel: env.LOG_LEVEL ?? 'info',
    accessTokenTtlMinutes: intFromEnv('ACCESS_TOKEN_TTL_MINUTES', 60),
    refreshTokenTtlDays: intFromEnv('REFRESH_TOKEN_TTL_DAYS', 7),
    lockoutThreshold: intFromEnv('LOCKOUT_THRESHOLD', 5),
    lockoutWindowMinutes: intFromEnv('LOCKOUT_WINDOW_MINUTES', 15),
    jwtPrivateKey: normalizePem(env.JWT_PRIVATE_KEY),
    jwtPublicKey: normalizePem(env.JWT_PUBLIC_KEY),
  };
}
