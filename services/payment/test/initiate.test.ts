/**
 * Task 8.3 — Property 25: Payment initiation binds one provider and matches the order total.
 * Validates: Requirements 11.1, 11.2
 */

import { AppError } from '@b2b/shared-node';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PROVIDERS, type Provider } from '../src/domain/providers.js';
import { fromPaisa } from '../src/domain/money.js';
import { makeHarness } from './helpers.js';

describe('Property 25: payment initiation binds one provider and matches the order total', () => {
  // Feature: b2b-wholesale-hub, Property 25: Payment initiation binds exactly one provider to the
  // transaction and initiates it in BDT for the full order total with a unique transaction id.

  it('binds exactly one supported provider for the full BDT order total with a unique txn id', async () => {
    const seen = new Set<string>();
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<Provider>(...PROVIDERS),
        fc.string({ minLength: 1, maxLength: 24 }).filter((s) => s.trim().length > 0),
        fc.integer({ min: 1, max: 9_999_999 }), // paisa → up to 99,999.99 BDT
        async (provider, orderId, paisa) => {
          const h = makeHarness();
          const expectedAmount = fromPaisa(paisa);
          h.inventory.totalsByOrder.set(orderId.trim(), expectedAmount);

          const result = await h.service.initiate({ orderId, provider }, 'corr-1');

          // Bound to exactly the one requested provider (Req 11.1).
          expect(result.provider).toBe(provider);
          expect(PROVIDERS).toContain(result.provider);
          // Full order total, in BDT (Req 11.2).
          expect(result.amount).toBe(expectedAmount);
          expect(result.currency).toBe('BDT');
          // Unique transaction id (Req 11.2).
          expect(result.txnId.length).toBeGreaterThan(0);
          expect(seen.has(result.txnId)).toBe(false);
          seen.add(result.txnId);
          // A checkout URL referencing the bound transaction is returned.
          expect(result.checkoutUrl).toContain(result.txnId);
          expect(result.status).toBe('PENDING');

          // The persisted transaction reflects the single binding and is not yet applied.
          const stored = await h.repos.transactions.findByTxnId(result.txnId);
          expect(stored).not.toBeNull();
          expect(stored!.provider).toBe(provider);
          expect(stored!.amount).toBe(expectedAmount);
          expect(stored!.applied).toBe(false);
          expect(stored!.orderId).toBe(orderId.trim());
        },
      ),
      { numRuns: 150 },
    );
  });

  it('rejects an unsupported or missing provider (no transaction created)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant(undefined),
          fc.constant(null),
          fc.constant(''),
          fc.string().filter((s) => !(PROVIDERS as readonly string[]).includes(s)),
        ),
        async (badProvider) => {
          const h = makeHarness();
          await expect(
            h.service.initiate({ orderId: 'order-1', provider: badProvider }, 'corr-1'),
          ).rejects.toBeInstanceOf(AppError);
        },
      ),
      { numRuns: 100 },
    );
  });
});
