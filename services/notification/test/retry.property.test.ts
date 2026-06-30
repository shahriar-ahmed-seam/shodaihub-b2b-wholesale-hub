/**
 * Task 9.3* — Property 42: notification delivery retries up to three times before recording failure.
 * Validates: Requirements 14.3
 *
 * fast-check, min 100 iterations.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { backoffSchedule, maxAttempts, type BackoffPolicy } from '../src/domain/backoff.js';
import { deliverWithRetry } from '../src/domain/delivery.js';
import { makeEvent, makeHarness, noopSleep, ScriptedChannel } from './helpers.js';

// Feature: b2b-wholesale-hub, Property 42: For any notification whose delivery fails, the system
// retries delivery up to 3 times with non-decreasing intervals between attempts, and records a
// delivery failure only after the retries are exhausted.
describe('Property 42: notification delivery retries up to three times before recording failure', () => {
  /** Arbitrary, well-formed backoff policy (factor >= 1 keeps intervals non-decreasing). */
  const policyArb: fc.Arbitrary<BackoffPolicy> = fc.record({
    maxRetries: fc.integer({ min: 0, max: 6 }),
    baseDelayMs: fc.integer({ min: 0, max: 2000 }),
    factor: fc.double({ min: 1, max: 4, noNaN: true }),
    maxDelayMs: fc.integer({ min: 0, max: 10_000 }),
  });

  it('never makes more attempts than 1 + maxRetries, and waits non-decreasing intervals', async () => {
    await fc.assert(
      fc.asyncProperty(policyArb, fc.integer({ min: 0, max: 12 }), async (policy, failUntil) => {
        const channel = new ScriptedChannel(failUntil);
        const outcome = await deliverWithRetry(() => channel.send({} as never), policy, noopSleep);

        const cap = maxAttempts(policy); // 1 + maxRetries
        // Up to (not beyond) the retry cap.
        expect(outcome.attempts).toBeLessThanOrEqual(cap);
        expect(outcome.attempts).toBeGreaterThanOrEqual(1);

        // Intervals actually waited are a prefix of the (non-decreasing) schedule.
        const schedule = backoffSchedule(policy);
        for (let i = 1; i < outcome.delaysMs.length; i += 1) {
          expect(outcome.delaysMs[i]!).toBeGreaterThanOrEqual(outcome.delaysMs[i - 1]!);
        }
        expect(outcome.delaysMs).toEqual(schedule.slice(0, outcome.delaysMs.length));
      }),
      { numRuns: 200 },
    );
  });

  it('records a failure only after retries are exhausted; success short-circuits', async () => {
    await fc.assert(
      fc.asyncProperty(policyArb, fc.integer({ min: 0, max: 12 }), async (policy, failUntil) => {
        const channel = new ScriptedChannel(failUntil);
        const outcome = await deliverWithRetry(() => channel.send({} as never), policy, noopSleep);

        const cap = maxAttempts(policy);
        const shouldSucceed = failUntil < cap; // a success attempt exists within the cap

        expect(outcome.delivered).toBe(shouldSucceed);
        // Failure is recorded iff every attempt failed (retries exhausted) — never earlier.
        expect(outcome.failureRecorded).toBe(!shouldSucceed);
        expect(outcome.deadLettered).toBe(!shouldSucceed);

        if (shouldSucceed) {
          expect(outcome.attempts).toBe(failUntil + 1);
        } else {
          expect(outcome.attempts).toBe(cap);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('with the design default (3 retries), an always-failing delivery is attempted exactly 4 times and recorded once', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('PAYMENT_CONFIRMED', 'NEW_ORDER', 'ORDER_STATUS_CHANGED', 'KYC_APPROVED'),
        fc.constantFrom('en', 'bn'),
        fc.uuid(),
        async (type, lang, userId) => {
          const h = makeHarness({
            channels: [new ScriptedChannel(Number.POSITIVE_INFINITY, 'EMAIL')],
            backoff: { maxRetries: 3, baseDelayMs: 1, factor: 2, maxDelayMs: 60_000 },
          });
          const res = await h.service.handleEvent(makeEvent({ userId, type, lang }));

          // Initial attempt + exactly 3 retries.
          expect(res.results[0]!.attempts).toBe(4);
          expect(res.results[0]!.failureRecorded).toBe(true);

          // The persisted row reflects a single recorded failure, and exactly one dead-letter exists.
          const rows = await h.repos.notifications.listForUser(userId);
          expect(rows).toHaveLength(1);
          expect(rows[0]).toMatchObject({ status: 'FAILED', attempts: 4 });
          expect(await h.repos.deadLetters.list()).toHaveLength(1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('a delivery that eventually succeeds within 3 retries records no failure', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 3 }), fc.uuid(), async (failUntil, userId) => {
        const h = makeHarness({
          channels: [new ScriptedChannel(failUntil, 'EMAIL')],
          backoff: { maxRetries: 3, baseDelayMs: 1, factor: 2, maxDelayMs: 60_000 },
        });
        const res = await h.service.handleEvent(makeEvent({ userId }));

        expect(res.results[0]!.delivered).toBe(true);
        expect(res.results[0]!.failureRecorded).toBe(false);
        expect(res.results[0]!.attempts).toBe(failUntil + 1);

        const rows = await h.repos.notifications.listForUser(userId);
        expect(rows[0]).toMatchObject({ status: 'DELIVERED' });
        expect(await h.repos.deadLetters.list()).toHaveLength(0);
      }),
      { numRuns: 100 },
    );
  });
});
