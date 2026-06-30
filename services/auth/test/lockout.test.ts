/**
 * Task 2.8 — Property 32: Lockout after five failures within fifteen minutes.
 * Validates: Requirements 1.7
 */

import { AppError } from '@b2b/shared-node';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  computeLockedUntil,
  DEFAULT_LOCKOUT_POLICY,
  isLockedAt,
  type Attempt,
} from '../src/domain/lockout.js';
import { makeActiveUser, makeHarness } from './helpers.js';

const WINDOW = DEFAULT_LOCKOUT_POLICY.windowMs; // 15 minutes
const T0 = Date.UTC(2025, 0, 1, 12, 0, 0);

function failuresAt(offsets: number[]): Attempt[] {
  return offsets.map((o) => ({ success: false, attemptedAt: T0 + o }));
}

describe('Property 32: lockout after five failures within fifteen minutes', () => {
  // Feature: b2b-wholesale-hub, Property 32: the account becomes locked for 15 minutes exactly
  // when it accumulates 5 consecutive failed attempts within a 15-minute window.

  it('fewer than five consecutive failures never locks', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: WINDOW }), { minLength: 1, maxLength: 4 }),
        (offsets) => {
          expect(computeLockedUntil(failuresAt(offsets))).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('exactly five failures within the window locks until the fifth failure + 15 minutes', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: WINDOW }), { minLength: 5, maxLength: 5 }),
        (offsets) => {
          const sorted = [...offsets].sort((a, b) => a - b);
          const fifth = T0 + sorted[4]!;
          const lockedUntil = computeLockedUntil(failuresAt(sorted));
          expect(lockedUntil).toBe(fifth + WINDOW);
          // The account is locked right after the fifth failure and unlocked once the window passes.
          expect(isLockedAt(failuresAt(sorted), fifth + 1)).toBe(true);
          expect(isLockedAt(failuresAt(sorted), fifth + WINDOW)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('five failures spanning more than the window do not lock', () => {
    fc.assert(
      fc.property(
        // Three free middle offsets; first pinned at 0, last strictly beyond the window.
        fc.uniqueArray(fc.integer({ min: 1, max: WINDOW }), { minLength: 3, maxLength: 3 }),
        fc.integer({ min: WINDOW + 1, max: 2 * WINDOW }),
        (middle, lastBeyond) => {
          const offsets = [0, ...middle, lastBeyond].sort((a, b) => a - b);
          expect(computeLockedUntil(failuresAt(offsets))).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('a successful attempt resets the consecutive-failure streak', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 1, max: 4 }),
        (before, after) => {
          const attempts: Attempt[] = [];
          for (let i = 0; i < before; i += 1) attempts.push({ success: false, attemptedAt: T0 + i * 1000 });
          attempts.push({ success: true, attemptedAt: T0 + 5000 });
          for (let i = 0; i < after; i += 1) attempts.push({ success: false, attemptedAt: T0 + 6000 + i * 1000 });
          // Neither run reaches the threshold of 5, so no lock.
          expect(computeLockedUntil(attempts)).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('service locks the account on the fifth failed login within the window (example)', async () => {
    const h = makeHarness();
    await makeActiveUser(h, 'lock@me.com', 'correct-password');

    for (let i = 0; i < 4; i += 1) {
      h.clock.advance(60_000);
      await expect(h.service.login('lock@me.com', 'wrong')).rejects.toMatchObject({ code: 'AUTH_FAILED' });
    }
    h.clock.advance(60_000);
    // Fifth consecutive failure within 15 minutes triggers the lock.
    await expect(h.service.login('lock@me.com', 'wrong')).rejects.toMatchObject({ code: 'ACCOUNT_LOCKED' });

    // Even correct credentials are now rejected while locked (Req 1.10).
    await expect(h.service.login('lock@me.com', 'correct-password')).rejects.toBeInstanceOf(AppError);
    await expect(h.service.login('lock@me.com', 'correct-password')).rejects.toMatchObject({
      code: 'ACCOUNT_LOCKED',
    });
  });
});
