/**
 * Pure account-lockout calculation (Req 1.7, 1.10).
 *
 * Lockout rule: an account locks for `windowMinutes` minutes the moment it accumulates
 * `threshold` (default 5) *consecutive* failed attempts whose span fits inside a rolling
 * `windowMinutes` (default 15) minute window. A successful attempt resets the consecutive streak.
 *
 * The function is deterministic and I/O-free so it can be property-tested over arbitrary
 * attempt sequences without a database (Property 32).
 */

export interface Attempt {
  success: boolean;
  /** Epoch milliseconds the attempt was recorded. */
  attemptedAt: number;
}

export interface LockoutPolicy {
  threshold: number;
  windowMs: number;
}

export const DEFAULT_LOCKOUT_POLICY: LockoutPolicy = {
  threshold: 5,
  windowMs: 15 * 60 * 1000,
};

/**
 * Given the full attempt history (in any order) determine when, if ever, a lockout was triggered.
 *
 * Returns the epoch-ms `lockedUntil` of the *most recent* triggered lockout, or `null` if no
 * qualifying streak exists. A lockout triggers on the k-th failure of a run of `threshold`
 * consecutive failures spanning `<= windowMs`; it expires `windowMs` after that triggering failure.
 */
export function computeLockedUntil(
  attempts: readonly Attempt[],
  policy: LockoutPolicy = DEFAULT_LOCKOUT_POLICY,
): number | null {
  const ordered = [...attempts].sort((a, b) => a.attemptedAt - b.attemptedAt);
  const streak: number[] = [];
  let lockedUntil: number | null = null;

  for (const attempt of ordered) {
    if (attempt.success) {
      streak.length = 0;
      continue;
    }
    streak.push(attempt.attemptedAt);
    if (streak.length >= policy.threshold) {
      const window = streak.slice(streak.length - policy.threshold);
      const first = window[0]!;
      const last = window[window.length - 1]!;
      if (last - first <= policy.windowMs) {
        lockedUntil = last + policy.windowMs;
      }
    }
  }

  return lockedUntil;
}

/** Whether the account is locked at instant `now` given its attempt history. */
export function isLockedAt(
  attempts: readonly Attempt[],
  now: number,
  policy: LockoutPolicy = DEFAULT_LOCKOUT_POLICY,
): boolean {
  const lockedUntil = computeLockedUntil(attempts, policy);
  return lockedUntil !== null && now < lockedUntil;
}

/**
 * Evaluate lockout state at `now`, accounting for a persisted `lockedUntil` (Req 1.10): an account
 * already flagged locked stays locked until its stored expiry regardless of new history.
 */
export function evaluateLockout(
  attempts: readonly Attempt[],
  now: number,
  storedLockedUntil: number | null,
  policy: LockoutPolicy = DEFAULT_LOCKOUT_POLICY,
): { locked: boolean; lockedUntil: number | null } {
  const computed = computeLockedUntil(attempts, policy);
  const effective = Math.max(computed ?? 0, storedLockedUntil ?? 0) || null;
  return { locked: effective !== null && now < effective, lockedUntil: effective };
}
