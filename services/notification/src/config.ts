/**
 * Environment-driven configuration for the Notification Service.
 *
 * All values come from environment variables (Req 20.4). Sensible local-dev defaults are provided
 * so the service and its test-suite can run without a populated `.env`.
 */

import type { BackoffPolicy } from './domain/backoff.js';

export interface NotificationConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  logLevel: string;
  redisUrl: string;
  stream: string;
  consumerGroup: string;
  consumerName: string;
  /** Optional channel toggles (Req 14.2). In-app is always enabled. */
  emailEnabled: boolean;
  smsEnabled: boolean;
  /** Delivery retry policy (Req 14.3). */
  backoff: BackoffPolicy;
}

function intFromEnv(name: string, fallback: number, env: NodeJS.ProcessEnv): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function numberFromEnv(name: string, fallback: number, env: NodeJS.ProcessEnv): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boolFromEnv(name: string, fallback: boolean, env: NodeJS.ProcessEnv): boolean {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): NotificationConfig {
  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    port: intFromEnv('NOTIFICATION_PORT', 3002, env),
    databaseUrl:
      env.NOTIFICATION_DB_URL ??
      'postgres://notifications:notifications_local_pw@localhost:5432/notifications',
    logLevel: env.LOG_LEVEL ?? 'info',
    redisUrl: env.REDIS_URL ?? 'redis://localhost:6379',
    stream: env.NOTIFICATION_STREAM ?? 'notifications',
    consumerGroup: env.NOTIFICATION_CONSUMER_GROUP ?? 'notification-service',
    consumerName: env.NOTIFICATION_CONSUMER_NAME ?? 'notification-1',
    emailEnabled: boolFromEnv('EMAIL_ENABLED', false, env),
    smsEnabled: boolFromEnv('SMS_ENABLED', false, env),
    backoff: {
      maxRetries: intFromEnv('NOTIFICATION_MAX_RETRIES', 3, env),
      baseDelayMs: intFromEnv('NOTIFICATION_BACKOFF_BASE_MS', 1000, env),
      factor: numberFromEnv('NOTIFICATION_BACKOFF_FACTOR', 2, env),
      maxDelayMs: intFromEnv('NOTIFICATION_BACKOFF_MAX_MS', 60_000, env),
    },
  };
}
