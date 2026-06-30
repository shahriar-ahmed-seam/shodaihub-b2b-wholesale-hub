/**
 * Delivery-with-retry executor (design: Error Handling → Notification retries; Req 14.3).
 *
 * Drives a single channel send through the backoff schedule: an initial attempt, then up to
 * `maxRetries` retries spaced by non-decreasing intervals. A delivery failure is recorded **only
 * after the retries are exhausted**; success short-circuits immediately.
 *
 * The executor is I/O-agnostic — the actual send is a callback and waiting is delegated to an
 * injectable `sleep`. This keeps the control flow a pure, deterministic function that the property
 * suite can drive with a fake channel and a no-op sleep (Property 42).
 */

import { backoffSchedule, normalizePolicy, type BackoffPolicy } from './backoff.js';

/** Performs the actual send for one attempt; resolves on success, rejects/throws on failure. */
export type SendFn = (attemptNumber: number) => Promise<void>;

/** Injectable wait used between attempts (default sleeps for real; tests pass a no-op). */
export type Sleep = (ms: number) => Promise<void>;

export const realSleep: Sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** Outcome of a delivery run, suitable for persisting status + auditing retries. */
export interface DeliveryOutcome {
  /** True when some attempt succeeded. */
  delivered: boolean;
  /** Total number of send attempts made (1 = succeeded first try; never exceeds maxRetries + 1). */
  attempts: number;
  /** The inter-attempt delays actually waited, in order (length === retries performed). */
  delaysMs: number[];
  /** True only when every attempt (initial + all retries) failed. */
  failureRecorded: boolean;
  /** True when the message was dead-lettered (i.e. failed after exhausting retries). */
  deadLettered: boolean;
  /** The error from the final failed attempt, if any. */
  lastError?: unknown;
}

/**
 * Attempt delivery with retries and backoff.
 *
 * @param send  Performs one delivery attempt; throwing/rejecting means that attempt failed.
 * @param policy Retry/backoff policy (retry count + interval growth).
 * @param sleep  Wait between attempts (injected for deterministic tests).
 */
export async function deliverWithRetry(
  send: SendFn,
  policy: BackoffPolicy,
  sleep: Sleep = realSleep,
): Promise<DeliveryOutcome> {
  const { maxRetries } = normalizePolicy(policy);
  const schedule = backoffSchedule(policy); // length === maxRetries, non-decreasing
  const delaysMs: number[] = [];

  let attempts = 0;
  let lastError: unknown;

  // Initial attempt (attempt #1) + up to maxRetries further attempts.
  for (let retry = 0; retry <= maxRetries; retry += 1) {
    if (retry > 0) {
      // Wait the scheduled interval *before* this retry.
      const delay = schedule[retry - 1] ?? 0;
      delaysMs.push(delay);
      await sleep(delay);
    }

    attempts += 1;
    try {
      await send(attempts);
      // Success: stop immediately; no failure recorded.
      return { delivered: true, attempts, delaysMs, failureRecorded: false, deadLettered: false };
    } catch (err) {
      lastError = err;
      // Fall through to the next retry (if any remain).
    }
  }

  // Every attempt failed: record the failure and dead-letter (Req 14.3).
  return {
    delivered: false,
    attempts,
    delaysMs,
    failureRecorded: true,
    deadLettered: true,
    lastError,
  };
}
