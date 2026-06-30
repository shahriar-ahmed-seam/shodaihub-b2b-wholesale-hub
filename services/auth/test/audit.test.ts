/**
 * Task 2.18 — Property 40: Auditable events are logged with type, user, and timestamp.
 * Validates: Requirements 19.5
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { AuthEvent } from '../src/services/events.js';
import { makeActiveUser, makeHarness } from './helpers.js';

type Action = 'register' | 'loginSuccess' | 'loginFailure' | 'refresh' | 'suspend' | 'accessDecision';

const actionArb = fc.constantFrom<Action>(
  'register',
  'loginSuccess',
  'loginFailure',
  'refresh',
  'suspend',
  'accessDecision',
);

const KNOWN_EVENTS = new Set<string>(Object.values(AuthEvent));

describe('Property 40: auditable events are logged with type, user, and timestamp', () => {
  // Feature: b2b-wholesale-hub, Property 40: For any authentication, authorization, or payment
  // event, an audit log entry is recorded containing the event type, the user identifier, and a
  // timestamp.
  it('every auth/authorization action records an audit row with type, user id, and timestamp', async () => {
    await fc.assert(
      fc.asyncProperty(actionArb, async (action) => {
        const h = makeHarness();
        const password = 'password1234';

        let userId: string;
        let expectedEvent: string;
        const opTime = () => h.clock.now();

        if (action === 'register') {
          const user = await h.service.register({
            email: 'audit@ex.com',
            password,
            businessName: 'Acme',
            role: 'RETAILER',
          });
          userId = user.id;
          expectedEvent = AuthEvent.USER_REGISTERED;
        } else {
          userId = await makeActiveUser(h, 'audit@ex.com', password);
          h.clock.advance(1000);
          if (action === 'loginSuccess') {
            await h.service.login('audit@ex.com', password);
            expectedEvent = AuthEvent.LOGIN_SUCCESS;
          } else if (action === 'loginFailure') {
            await h.service.login('audit@ex.com', 'wrong').catch(() => undefined);
            expectedEvent = AuthEvent.LOGIN_FAILURE;
          } else if (action === 'refresh') {
            const s = await h.service.login('audit@ex.com', password);
            h.clock.advance(1000);
            await h.service.refresh(s.refreshToken);
            expectedEvent = AuthEvent.TOKEN_REFRESHED;
          } else if (action === 'suspend') {
            await h.service.suspendUser(userId);
            expectedEvent = AuthEvent.ACCOUNT_SUSPENDED;
          } else {
            await h.service.recordAccessDecision(userId, true, { action: 'read' });
            expectedEvent = AuthEvent.ACCESS_GRANTED;
          }
        }

        const timestamp = opTime();
        const all = await h.repos.auditLog.listAll();

        // Universal shape invariant: every record has a known event type and a numeric timestamp.
        for (const entry of all) {
          expect(typeof entry.eventType).toBe('string');
          expect(entry.eventType.length).toBeGreaterThan(0);
          expect(KNOWN_EVENTS.has(entry.eventType)).toBe(true);
          expect(Number.isFinite(entry.createdAt)).toBe(true);
        }

        // The action's event was recorded for the user, with the timestamp from the clock.
        const forUser = await h.repos.auditLog.listForUser(userId);
        const match = forUser.find((e) => e.eventType === expectedEvent);
        expect(match).toBeDefined();
        expect(match!.userId).toBe(userId);
        expect(match!.createdAt).toBe(timestamp);
      }),
      { numRuns: 100 },
    );
  });
});
