/**
 * Task 2.12 — Property 35: Refresh token rotation invalidates the old token.
 * Validates: Requirements 1.6
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { makeActiveUser, makeHarness } from './helpers.js';

const sessionArb = fc.record({
  email: fc
    .tuple(fc.stringMatching(/^[a-z0-9]{1,8}$/), fc.constantFrom('com', 'io', 'bd'))
    .map(([l, t]) => `${l}@ex.${t}`),
  password: fc.string({ minLength: 8, maxLength: 40 }),
  role: fc.constantFrom('SUPPLIER' as const, 'RETAILER' as const, 'ADMINISTRATOR' as const),
});

describe('Property 35: refresh token rotation invalidates the old token', () => {
  // Feature: b2b-wholesale-hub, Property 35: For any valid, unexpired, unrevoked refresh token,
  // refreshing issues a new access token and a new refresh token and invalidates the submitted
  // refresh token so it cannot be reused.
  it('rotation issues a fresh pair and the old refresh token cannot be reused', async () => {
    await fc.assert(
      fc.asyncProperty(sessionArb, async ({ email, password, role }) => {
        const h = makeHarness();
        const userId = await makeActiveUser(h, email, password, role);

        const first = await h.service.login(email, password);
        h.clock.advance(1000);
        const rotated = await h.service.refresh(first.refreshToken);

        // New tokens are genuinely new.
        expect(rotated.refreshToken).not.toBe(first.refreshToken);
        expect(rotated.accessToken).not.toBe('');

        // New access token verifies and carries the right subject + role.
        const verified = h.tokens.verifyAccessToken(rotated.accessToken);
        expect(verified.valid).toBe(true);
        if (verified.valid) {
          expect(verified.claims.sub).toBe(userId);
          expect(verified.claims.role).toBe(role);
        }

        // The submitted (old) refresh token is now invalid.
        await expect(h.service.refresh(first.refreshToken)).rejects.toMatchObject({
          code: 'INVALID_REFRESH_TOKEN',
        });

        // The new refresh token works exactly once, then it too is rotated out.
        h.clock.advance(1000);
        const rotated2 = await h.service.refresh(rotated.refreshToken);
        expect(rotated2.refreshToken).not.toBe(rotated.refreshToken);
        await expect(h.service.refresh(rotated.refreshToken)).rejects.toMatchObject({
          code: 'INVALID_REFRESH_TOKEN',
        });
      }),
      { numRuns: 100 },
    );
  });

  it('logout revokes the refresh token (example-based)', async () => {
    const h = makeHarness();
    await makeActiveUser(h, 'logout@ex.com', 'password123');
    const session = await h.service.login('logout@ex.com', 'password123');
    await h.service.logout(session.refreshToken);
    await expect(h.service.refresh(session.refreshToken)).rejects.toMatchObject({
      code: 'INVALID_REFRESH_TOKEN',
    });
  });

  it('expired or malformed refresh tokens are rejected (example-based)', async () => {
    const h = makeHarness({ refreshTtlDays: 7 });
    await makeActiveUser(h, 'exp@ex.com', 'password123');
    const session = await h.service.login('exp@ex.com', 'password123');

    // Advance beyond the 7-day refresh TTL.
    h.clock.advance(8 * 24 * 60 * 60 * 1000);
    await expect(h.service.refresh(session.refreshToken)).rejects.toMatchObject({
      code: 'INVALID_REFRESH_TOKEN',
    });
    await expect(h.service.refresh('garbage-token')).rejects.toMatchObject({
      code: 'INVALID_REFRESH_TOKEN',
    });
  });
});
