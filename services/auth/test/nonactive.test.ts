/**
 * Task 2.10 — Property 31: Non-active accounts reject all authentication.
 * Validates: Requirements 1.10, 16.3
 */

import { AppError } from '@b2b/shared-node';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { makeHarness } from './helpers.js';

const credsArb = fc.record({
  password: fc.string({ minLength: 8, maxLength: 64 }),
  // Attempt with either the real password or an arbitrary other one.
  attempt: fc.string({ minLength: 0, maxLength: 64 }),
  useCorrect: fc.boolean(),
});

describe('Property 31: non-active accounts reject all authentication', () => {
  // Feature: b2b-wholesale-hub, Property 31: For any account in LOCKED or SUSPENDED state, every
  // authentication attempt is rejected with the appropriate message, including attempts presenting
  // otherwise-correct credentials.

  it('SUSPENDED accounts reject every login attempt (even correct credentials)', async () => {
    await fc.assert(
      fc.asyncProperty(credsArb, async ({ password, attempt, useCorrect }) => {
        const h = makeHarness();
        const user = await h.service.register({
          email: 'sus@x.com',
          password,
          businessName: 'Acme',
          role: 'SUPPLIER',
        });
        await h.repos.users.updateStatus(user.id, 'SUSPENDED');

        const supplied = useCorrect ? password : attempt;
        await expect(h.service.login('sus@x.com', supplied)).rejects.toMatchObject({
          code: 'ACCOUNT_SUSPENDED',
        });
      }),
      { numRuns: 100 },
    );
  });

  it('LOCKED accounts reject every login attempt (even correct credentials)', async () => {
    await fc.assert(
      fc.asyncProperty(credsArb, async ({ password, attempt, useCorrect }) => {
        const h = makeHarness();
        const user = await h.service.register({
          email: 'locked@x.com',
          password,
          businessName: 'Acme',
          role: 'RETAILER',
        });
        await h.repos.users.updateStatus(user.id, 'ACTIVE');
        // Flag a future lock directly.
        await h.repos.users.setLockedUntil(user.id, h.clock.now() + 5 * 60_000);

        const supplied = useCorrect ? password : attempt;
        const error = await h.service.login('locked@x.com', supplied).then(
          () => null,
          (e) => e,
        );
        expect(error).toBeInstanceOf(AppError);
        expect(error.code).toBe('ACCOUNT_LOCKED');
      }),
      { numRuns: 100 },
    );
  });
});
