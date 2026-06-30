/**
 * Task 8.7 — Property 27: Callback application is idempotent.
 * Validates: Requirements 11.7
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PROVIDERS, type Provider } from '../src/domain/providers.js';
import type { CallbackPayload } from '../src/domain/signature.js';
import { makeHarness, signedCallbackBody, NOTIFICATIONS_STREAM } from './helpers.js';

describe('Property 27: callback application is idempotent', () => {
  // Feature: b2b-wholesale-hub, Property 27: applying N duplicate authentic success callbacks for
  // the same transaction id has the same effect as applying it exactly once — the order is
  // confirmed a single time and later duplicates return 200 without re-applying.

  it('N duplicate authentic success callbacks confirm the order exactly once', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<Provider>(...PROVIDERS),
        fc.string({ minLength: 1, maxLength: 16 }).filter((s) => s.trim().length > 0),
        fc.integer({ min: 1, max: 9_999_999 }),
        fc.integer({ min: 1, max: 8 }), // number of duplicate deliveries
        async (provider, orderId, paisa, duplicates) => {
          const h = makeHarness();
          const amount = (paisa / 100).toFixed(2);
          h.inventory.totalsByOrder.set(orderId.trim(), amount);
          const init = await h.service.initiate({ orderId, provider }, 'corr');

          const payload: CallbackPayload = {
            txnId: init.txnId,
            orderId: init.orderId,
            status: 'success',
            amount: init.amount,
          };
          const body = signedCallbackBody(provider, payload);

          const outcomes: string[] = [];
          for (let i = 0; i < duplicates; i += 1) {
            const r = await h.service.handleCallback({ provider, body, correlationId: 'corr' });
            outcomes.push(r.outcome);
            expect(r.httpStatus).toBe(200);
            expect(r.applied).toBe(true);
            expect(r.status).toBe('SUCCESS');
          }

          // Applied exactly once regardless of how many duplicates arrived (Req 11.7).
          expect(h.inventory.confirmCalls).toHaveLength(1);
          expect(outcomes[0]).toBe('applied');
          expect(outcomes.slice(1).every((o) => o === 'duplicate')).toBe(true);

          const stored = await h.repos.transactions.findByTxnId(init.txnId);
          expect(stored!.status).toBe('SUCCESS');
          expect(stored!.applied).toBe(true);

          // Notifications emitted once: one to the retailer + one per supplier (Req 11.5).
          const emitted = h.events.forStream(NOTIFICATIONS_STREAM);
          expect(emitted.filter((e) => e.type === 'PAYMENT_CONFIRMED')).toHaveLength(1);
          expect(emitted.filter((e) => e.type === 'NEW_ORDER')).toHaveLength(
            h.inventory.supplierIds.length,
          );
        },
      ),
      { numRuns: 120 },
    );
  });
});
