/**
 * Task 9.2 — unit tests for the deliver-with-retry executor (Req 14.3).
 */

import { describe, expect, it } from 'vitest';
import { deliverWithRetry } from '../src/domain/delivery.js';
import { noopSleep } from './helpers.js';

const POLICY = { maxRetries: 3, baseDelayMs: 1000, factor: 2, maxDelayMs: 60_000 };

describe('deliverWithRetry', () => {
  it('succeeds on the first attempt without recording failure', async () => {
    let calls = 0;
    const outcome = await deliverWithRetry(
      async () => {
        calls += 1;
      },
      POLICY,
      noopSleep,
    );
    expect(calls).toBe(1);
    expect(outcome).toMatchObject({ delivered: true, attempts: 1, failureRecorded: false });
    expect(outcome.delaysMs).toEqual([]);
  });

  it('retries then succeeds; no failure recorded', async () => {
    let calls = 0;
    const outcome = await deliverWithRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error('transient');
      },
      POLICY,
      noopSleep,
    );
    expect(outcome).toMatchObject({ delivered: true, attempts: 3, failureRecorded: false });
    // Two retries happened before success → two waited delays.
    expect(outcome.delaysMs).toEqual([1000, 2000]);
  });

  it('records failure + dead-letter only after exhausting retries', async () => {
    let calls = 0;
    const outcome = await deliverWithRetry(
      async () => {
        calls += 1;
        throw new Error('always fails');
      },
      POLICY,
      noopSleep,
    );
    expect(calls).toBe(4); // initial + 3 retries
    expect(outcome).toMatchObject({
      delivered: false,
      attempts: 4,
      failureRecorded: true,
      deadLettered: true,
    });
    expect(outcome.delaysMs).toEqual([1000, 2000, 4000]);
  });

  it('with zero retries makes a single attempt', async () => {
    let calls = 0;
    const outcome = await deliverWithRetry(
      async () => {
        calls += 1;
        throw new Error('fail');
      },
      { maxRetries: 0, baseDelayMs: 1000, factor: 2 },
      noopSleep,
    );
    expect(calls).toBe(1);
    expect(outcome).toMatchObject({ delivered: false, attempts: 1, failureRecorded: true });
  });
});
