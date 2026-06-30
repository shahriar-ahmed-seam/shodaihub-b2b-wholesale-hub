/**
 * Retry/backoff scheduling — pure, deterministic, dependency-free (design: Error Handling →
 * Notification retries; Req 14.3).
 *
 * A failed notification delivery is retried up to `maxRetries` times with **non-decreasing**
 * (exponential) intervals between attempts. Keeping this logic pure lets the property suite
 * (Property 42) exercise it across many policies without any I/O, clock, or live broker.
 */

/** Policy describing how many times to retry and how the inter-attempt delay grows. */
export interface BackoffPolicy {
  /** Number of retries attempted *after* the initial delivery attempt (design fixes this at 3). */
  maxRetries: number;
  /** Delay before the first retry, in milliseconds. */
  baseDelayMs: number;
  /** Exponential growth factor applied per retry; must be >= 1 to keep delays non-decreasing. */
  factor: number;
  /** Optional upper bound on any single delay, in milliseconds. */
  maxDelayMs?: number;
}

/** Design default: 3 retries, 1s base, doubling, capped at 60s (Req 14.3). */
export const DEFAULT_BACKOFF_POLICY: BackoffPolicy = {
  maxRetries: 3,
  baseDelayMs: 1000,
  factor: 2,
  maxDelayMs: 60_000,
};

/** Clamp/normalize a policy so downstream code can rely on sane, non-negative values. */
export function normalizePolicy(policy: BackoffPolicy): Required<BackoffPolicy> {
  const maxRetries = Math.max(0, Math.floor(policy.maxRetries));
  const baseDelayMs = Math.max(0, policy.baseDelayMs);
  // factor < 1 would make delays shrink; pin to 1 so intervals are guaranteed non-decreasing.
  const factor = policy.factor >= 1 ? policy.factor : 1;
  const maxDelayMs =
    policy.maxDelayMs === undefined ? Number.POSITIVE_INFINITY : Math.max(0, policy.maxDelayMs);
  return { maxRetries, baseDelayMs, factor, maxDelayMs };
}

/**
 * Delay (ms) to wait before retry number `retryIndex` (1-based: 1 = first retry).
 * Returns 0 for out-of-range indices.
 */
export function retryDelayMs(policy: BackoffPolicy, retryIndex: number): number {
  const { baseDelayMs, factor, maxDelayMs, maxRetries } = normalizePolicy(policy);
  if (retryIndex < 1 || retryIndex > maxRetries) return 0;
  const raw = baseDelayMs * Math.pow(factor, retryIndex - 1);
  return Math.min(maxDelayMs, raw);
}

/**
 * The full ordered list of inter-attempt delays, one per retry (length === `maxRetries`).
 * The list is guaranteed non-decreasing (Req 14.3 "increasing intervals").
 */
export function backoffSchedule(policy: BackoffPolicy): number[] {
  const { maxRetries } = normalizePolicy(policy);
  const delays: number[] = [];
  for (let r = 1; r <= maxRetries; r += 1) {
    delays.push(retryDelayMs(policy, r));
  }
  return delays;
}

/** Maximum number of delivery attempts a policy permits (initial attempt + retries). */
export function maxAttempts(policy: BackoffPolicy): number {
  return normalizePolicy(policy).maxRetries + 1;
}
