/**
 * Task 2.14 — Property 38: Suspension revokes sessions.
 * Validates: Requirements 16.2
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { makeActiveUser, makeHarness } from './helpers.js';

describe('Property 38: suspension revokes sessions', () => {
  // Feature: b2b-wholesale-hub, Property 38: For any account suspended by an administrator, the
  // account status becomes SUSPENDED and all of its active refresh tokens are invalidated.
  it('suspending sets status SUSPENDED and invalidates every active refresh token', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 6 }), async (sessionCount) => {
        const h = makeHarness();
        const userId = await makeActiveUser(h, 'multi@ex.com', 'password123');

        const refreshTokens: string[] = [];
        for (let i = 0; i < sessionCount; i += 1) {
          h.clock.advance(1000);
          const session = await h.service.login('multi@ex.com', 'password123');
          refreshTokens.push(session.refreshToken);
        }

        const suspended = await h.service.suspendUser(userId);
        expect(suspended.status).toBe('SUSPENDED');

        const stored = await h.repos.users.findById(userId);
        expect(stored?.status).toBe('SUSPENDED');

        // Every previously-issued refresh token is now invalid.
        for (const token of refreshTokens) {
          await expect(h.service.refresh(token)).rejects.toMatchObject({
            code: 'INVALID_REFRESH_TOKEN',
          });
        }
      }),
      { numRuns: 100 },
    );
  });
});
