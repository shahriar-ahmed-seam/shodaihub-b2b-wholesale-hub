/**
 * Task 8.5 — Property 26: Only authentic callbacks are applied.
 * Validates: Requirements 11.6, 11.8
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PROVIDERS, type Provider } from '../src/domain/providers.js';
import {
  computeSignature,
  verifySignature,
  type CallbackPayload,
} from '../src/domain/signature.js';
import { makeHarness, signedCallbackBody, TEST_SECRETS } from './helpers.js';

/** Flip one hex nibble so the signature is guaranteed different (still same length). */
function tamper(signature: string): string {
  const first = signature[0] === '0' ? '1' : '0';
  return first + signature.slice(1);
}

describe('Property 26: only authentic callbacks are applied', () => {
  // Feature: b2b-wholesale-hub, Property 26: a callback is applied to the order if and only if its
  // signature verifies against the bound provider's secret; inauthentic callbacks are rejected,
  // leave the order unchanged, and are recorded.

  it('pure signature verification holds exactly for the authentic signature', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Provider>(...PROVIDERS),
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.string({ maxLength: 30 }),
        fc.constantFrom<'success' | 'failed'>('success', 'failed'),
        fc.integer({ min: 1, max: 9_999_999 }),
        (provider, txnId, orderId, status, paisa) => {
          const secret = TEST_SECRETS[provider].secret;
          const payload: CallbackPayload = {
            txnId,
            orderId,
            status,
            amount: (paisa / 100).toFixed(2),
          };
          const good = computeSignature(payload, secret);
          expect(verifySignature(payload, good, secret)).toBe(true);
          expect(verifySignature(payload, tamper(good), secret)).toBe(false);
          // A different secret never verifies.
          expect(verifySignature(payload, good, secret + 'x')).toBe(false);
        },
      ),
      { numRuns: 120 },
    );
  });

  it('the service applies a success callback iff it is authentic, recording rejections', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<Provider>(...PROVIDERS),
        fc.string({ minLength: 1, maxLength: 16 }).filter((s) => s.trim().length > 0),
        fc.integer({ min: 1, max: 9_999_999 }),
        fc.boolean(),
        async (provider, orderId, paisa, authentic) => {
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
          const body = authentic
            ? signedCallbackBody(provider, payload)
            : { ...payload, signature: tamper(computeSignature(payload, TEST_SECRETS[provider].secret)) };

          const result = await h.service.handleCallback({ provider, body, correlationId: 'corr' });

          if (authentic) {
            expect(result.outcome).toBe('applied');
            expect(result.applied).toBe(true);
            expect(result.status).toBe('SUCCESS');
            // Authentic success drives exactly one Inventory confirm (Req 11.3).
            expect(h.inventory.confirmCalls).toHaveLength(1);
            expect(await h.repos.rejectedCallbacks.list()).toHaveLength(0);
          } else {
            // Inauthentic callback rejected, order unchanged, recorded (Req 11.8).
            expect(result.outcome).toBe('rejected');
            expect(result.httpStatus).toBe(400);
            expect(h.inventory.confirmCalls).toHaveLength(0);
            const stored = await h.repos.transactions.findByTxnId(init.txnId);
            expect(stored!.status).toBe('PENDING');
            expect(stored!.applied).toBe(false);
            const rejected = await h.repos.rejectedCallbacks.list();
            expect(rejected).toHaveLength(1);
            expect(rejected[0]!.reason).toBe('INVALID_SIGNATURE');
          }
        },
      ),
      { numRuns: 120 },
    );
  });
});
