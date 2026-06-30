/**
 * Task 8.9 — Property 28: Payment success confirms and converts; failure preserves.
 * Validates: Requirements 11.3, 11.4
 *
 * Also exercises the late-success reconciliation path (Req 11.9), the 5-minute timeout sweep
 * (Req 11.4), and the GET /payments/{txnId} status path as examples.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PROVIDERS, type Provider } from '../src/domain/providers.js';
import type { CallbackPayload } from '../src/domain/signature.js';
import { makeHarness, signedCallbackBody, NOTIFICATIONS_STREAM } from './helpers.js';

async function initiateTxn(
  h: ReturnType<typeof makeHarness>,
  provider: Provider,
  orderId: string,
  amount: string,
) {
  h.inventory.totalsByOrder.set(orderId.trim(), amount);
  return h.service.initiate({ orderId, provider }, 'corr');
}

describe('Property 28: success confirms/converts; failure preserves', () => {
  // Feature: b2b-wholesale-hub, Property 28: an authentic success with active reservations confirms
  // the sub-orders and converts reservations (one Inventory confirm); an authentic failure leaves
  // the order PENDING and retains reservations (no Inventory confirm).

  it('authentic success confirms while authentic failure preserves', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<Provider>(...PROVIDERS),
        fc.string({ minLength: 1, maxLength: 16 }).filter((s) => s.trim().length > 0),
        fc.integer({ min: 1, max: 9_999_999 }),
        fc.boolean(),
        async (provider, orderId, paisa, success) => {
          const h = makeHarness();
          const amount = (paisa / 100).toFixed(2);
          const init = await initiateTxn(h, provider, orderId, amount);

          const payload: CallbackPayload = {
            txnId: init.txnId,
            orderId: init.orderId,
            status: success ? 'success' : 'failed',
            amount: init.amount,
          };
          const result = await h.service.handleCallback({
            provider,
            body: signedCallbackBody(provider, payload),
            correlationId: 'corr',
          });

          const stored = await h.repos.transactions.findByTxnId(init.txnId);
          if (success) {
            // Confirms + converts: one Inventory confirm, SUCCESS, notifications emitted (Req 11.3, 11.5).
            expect(result.outcome).toBe('applied');
            expect(stored!.status).toBe('SUCCESS');
            expect(stored!.applied).toBe(true);
            expect(h.inventory.confirmCalls).toHaveLength(1);
            expect(h.events.forStream(NOTIFICATIONS_STREAM).length).toBeGreaterThan(0);
          } else {
            // Preserves: no Inventory confirm, sub-orders stay PENDING, reservations retained (Req 11.4).
            expect(result.outcome).toBe('failure');
            expect(stored!.status).toBe('FAILED');
            expect(stored!.applied).toBe(false);
            expect(h.inventory.confirmCalls).toHaveLength(0);
            expect(h.events.forStream(NOTIFICATIONS_STREAM)).toHaveLength(0);
          }
        },
      ),
      { numRuns: 120 },
    );
  });

  it('late authentic success with insufficient stock flags NEEDS_RECONCILIATION and keeps sub-orders PENDING (Req 11.9)', async () => {
    const h = makeHarness();
    h.inventory.confirmOutcome = 'INSUFFICIENT_STOCK';
    const init = await initiateTxn(h, 'bkash', 'order-recon', '250.00');
    const payload: CallbackPayload = {
      txnId: init.txnId,
      orderId: init.orderId,
      status: 'success',
      amount: init.amount,
    };

    const result = await h.service.handleCallback({
      provider: 'bkash',
      body: signedCallbackBody('bkash', payload),
      correlationId: 'corr',
    });

    expect(result.status).toBe('NEEDS_RECONCILIATION');
    expect(h.inventory.confirmCalls).toHaveLength(1);
    const stored = await h.repos.transactions.findByTxnId(init.txnId);
    expect(stored!.status).toBe('NEEDS_RECONCILIATION');
    // No success notifications emitted when the order could not be confirmed.
    expect(h.events.forStream(NOTIFICATIONS_STREAM)).toHaveLength(0);
  });

  it('times out un-applied PENDING transactions after the 5-minute window (Req 11.4)', async () => {
    const h = makeHarness({ timeoutMinutes: 5 });
    const init = await initiateTxn(h, 'nagad', 'order-timeout', '99.99');

    // Before the window: no timeout.
    h.clock.advance(4 * 60 * 1000);
    expect(await h.service.sweepTimeouts()).toHaveLength(0);

    // After the window: the transaction times out; sub-orders stay PENDING (Inventory untouched).
    h.clock.advance(2 * 60 * 1000);
    const timedOut = await h.service.sweepTimeouts();
    expect(timedOut).toContain(init.txnId);
    const stored = await h.repos.transactions.findByTxnId(init.txnId);
    expect(stored!.status).toBe('TIMED_OUT');
    expect(h.inventory.confirmCalls).toHaveLength(0);
  });

  it('GET status returns the current transaction state', async () => {
    const h = makeHarness();
    const init = await initiateTxn(h, 'sslcommerz', 'order-status', '500.00');
    const status = await h.service.getStatus(init.txnId);
    expect(status.txnId).toBe(init.txnId);
    expect(status.status).toBe('PENDING');
    await expect(h.service.getStatus('nope')).rejects.toMatchObject({ code: 'TXN_NOT_FOUND' });
  });
});
