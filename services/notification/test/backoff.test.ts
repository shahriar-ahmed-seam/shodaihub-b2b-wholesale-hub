/**
 * Task 9.2 — unit tests for the retry/backoff scheduling (Req 14.3).
 */

import { describe, expect, it } from 'vitest';
import {
  backoffSchedule,
  DEFAULT_BACKOFF_POLICY,
  maxAttempts,
  normalizePolicy,
  retryDelayMs,
} from '../src/domain/backoff.js';

describe('backoff scheduling', () => {
  it('default policy: 3 retries → 4 max attempts', () => {
    expect(maxAttempts(DEFAULT_BACKOFF_POLICY)).toBe(4);
    expect(backoffSchedule(DEFAULT_BACKOFF_POLICY)).toHaveLength(3);
  });

  it('produces exponentially increasing delays', () => {
    const schedule = backoffSchedule({ maxRetries: 3, baseDelayMs: 1000, factor: 2 });
    expect(schedule).toEqual([1000, 2000, 4000]);
  });

  it('caps each delay at maxDelayMs', () => {
    const schedule = backoffSchedule({
      maxRetries: 4,
      baseDelayMs: 1000,
      factor: 10,
      maxDelayMs: 5000,
    });
    expect(schedule).toEqual([1000, 5000, 5000, 5000]);
  });

  it('pins factor < 1 to 1 so delays never shrink', () => {
    const schedule = backoffSchedule({ maxRetries: 3, baseDelayMs: 1000, factor: 0.5 });
    expect(schedule).toEqual([1000, 1000, 1000]);
  });

  it('out-of-range retry index yields 0', () => {
    const policy = { maxRetries: 2, baseDelayMs: 1000, factor: 2 };
    expect(retryDelayMs(policy, 0)).toBe(0);
    expect(retryDelayMs(policy, 3)).toBe(0);
  });

  it('normalizes negative/odd inputs', () => {
    const n = normalizePolicy({ maxRetries: -2, baseDelayMs: -5, factor: 0 });
    expect(n.maxRetries).toBe(0);
    expect(n.baseDelayMs).toBe(0);
    expect(n.factor).toBe(1);
  });
});
