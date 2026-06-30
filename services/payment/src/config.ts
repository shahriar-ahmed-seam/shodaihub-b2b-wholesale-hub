/**
 * Environment-driven configuration for the Payment Gateway.
 *
 * All values come from environment variables (Req 19.4, 20.4). Provider credentials/secrets are
 * read from the environment (i.e. a secrets store in hosted environments) and are never hard-coded
 * in source. Sensible local-dev defaults let the service and its test-suite run without a populated
 * `.env`.
 */

import type { Provider } from './domain/providers.js';

/** Per-provider secret material used for sandbox checkout + callback authenticity (Req 11.6). */
export interface ProviderSecrets {
  /** Identifier (api key / merchant id / store id). */
  id: string;
  /** Shared secret used to compute/verify the callback HMAC signature. */
  secret: string;
}

export interface PaymentConfig {
  nodeEnv: string;
  port: number;
  logLevel: string;
  databaseUrl: string;
  /** Base URL of the Inventory Service (order totals + confirm). */
  inventoryServiceUrl: string;
  /** Redis connection URL for the Streams event bus. */
  redisUrl: string;
  /** Minutes after initiation without authenticated success before a sweep times the txn out. */
  timeoutMinutes: number;
  /** Provider credentials/secrets keyed by provider name. */
  providerSecrets: Record<Provider, ProviderSecrets>;
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

/**
 * Resolve a provider's secret, falling back to a deterministic local-dev secret when the env var
 * is absent so the sandbox flow and tests work out-of-the-box. In hosted environments the real
 * secret is always supplied via the secrets store (Req 19.4).
 */
function providerSecret(
  env: NodeJS.ProcessEnv,
  idVar: string,
  secretVar: string,
  devFallback: string,
): ProviderSecrets {
  return {
    id: strFromEnv(env, idVar, `${devFallback}-id`),
    secret: strFromEnv(env, secretVar, `${devFallback}-secret`),
  };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): PaymentConfig {
  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    port: intFromEnv(env, 'PAYMENT_PORT', 3003),
    logLevel: env.LOG_LEVEL ?? 'info',
    databaseUrl:
      env.PAYMENT_DB_URL ?? 'postgres://payment:payment_local_pw@localhost:5432/payment',
    inventoryServiceUrl: strFromEnv(env, 'INVENTORY_SERVICE_URL', 'http://localhost:8081'),
    redisUrl: strFromEnv(env, 'REDIS_URL', 'redis://localhost:6379'),
    timeoutMinutes: intFromEnv(env, 'PAYMENT_TIMEOUT_MINUTES', 5),
    providerSecrets: {
      bkash: providerSecret(env, 'BKASH_API_KEY', 'BKASH_API_SECRET', 'bkash-local'),
      nagad: providerSecret(env, 'NAGAD_MERCHANT_ID', 'NAGAD_API_SECRET', 'nagad-local'),
      sslcommerz: providerSecret(
        env,
        'SSLCOMMERZ_STORE_ID',
        'SSLCOMMERZ_STORE_PASSWORD',
        'sslcommerz-local',
      ),
    },
  };
}
