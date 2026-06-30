/**
 * Environment-driven configuration for the API Gateway / BFF.
 *
 * All values come from environment variables (Req 20.4). Sensible local-dev defaults are
 * provided so the service and its test-suite can run without a populated `.env`. Upstream
 * service base URLs are injected so the BFF can fan out to Auth, Inventory, Search, and
 * Payment without hard-coding hostnames (design: Components → API Gateway/BFF).
 */

import type { UpstreamService } from './domain/permissions.js';

export interface BffConfig {
  nodeEnv: string;
  port: number;
  logLevel: string;
  /** Base URLs for each upstream service, keyed by logical service name. */
  serviceUrls: Record<UpstreamService, string>;
  /** RS256 PUBLIC key PEM (verify only). Empty → an ephemeral keypair is generated for local/test. */
  jwtPublicKey: string;
  /** Max accepted request body size (express body-parser limit syntax, e.g. `256kb`). */
  bodyLimit: string;
  /** General per-IP rate limit. */
  rateLimitWindowMs: number;
  rateLimitMax: number;
  /** Stricter rate limit for auth routes (credential-stuffing protection, Req 1.7 support). */
  authRateLimitWindowMs: number;
  authRateLimitMax: number;
  /** Upstream request timeout in milliseconds before the gateway returns 504. */
  upstreamTimeoutMs: number;
}

/** Normalize PEM material that arrives with literal `\n` sequences (common in env vars). */
function normalizePem(value: string | undefined): string {
  if (!value) return '';
  return value.includes('\\n') ? value.replace(/\\n/g, '\n') : value;
}

function intFromEnv(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function strFromEnv(env: NodeJS.ProcessEnv, name: string, fallback: string): string {
  const raw = env[name];
  return raw === undefined || raw.trim() === '' ? fallback : raw.trim();
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BffConfig {
  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    port: intFromEnv(env, 'BFF_PORT', 8080),
    logLevel: env.LOG_LEVEL ?? 'info',
    serviceUrls: {
      auth: strFromEnv(env, 'AUTH_SERVICE_URL', 'http://localhost:3001'),
      inventory: strFromEnv(env, 'INVENTORY_SERVICE_URL', 'http://localhost:8081'),
      search: strFromEnv(env, 'SEARCH_SERVICE_URL', 'http://localhost:8000'),
      payment: strFromEnv(env, 'PAYMENT_SERVICE_URL', 'http://localhost:3003'),
    },
    jwtPublicKey: normalizePem(env.JWT_PUBLIC_KEY),
    bodyLimit: strFromEnv(env, 'BFF_BODY_LIMIT', '256kb'),
    rateLimitWindowMs: intFromEnv(env, 'RATE_LIMIT_WINDOW_MS', 60_000),
    rateLimitMax: intFromEnv(env, 'RATE_LIMIT_MAX', 300),
    authRateLimitWindowMs: intFromEnv(env, 'AUTH_RATE_LIMIT_WINDOW_MS', 900_000),
    authRateLimitMax: intFromEnv(env, 'AUTH_RATE_LIMIT_MAX', 20),
    upstreamTimeoutMs: intFromEnv(env, 'UPSTREAM_TIMEOUT_MS', 10_000),
  };
}
