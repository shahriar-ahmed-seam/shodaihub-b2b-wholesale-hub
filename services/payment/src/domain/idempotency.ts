/**
 * Pure callback-application decision logic (Req 11.6, 11.7, 11.8).
 *
 * Given the current state of a transaction and whether an incoming callback is authentic, decide
 * what the gateway should do. Keeping this pure makes the authenticity (Property 26) and
 * idempotency (Property 27) invariants directly testable, independent of the database's atomic
 * insert-on-conflict mechanics that ultimately enforce single-application under concurrency.
 */

import type { PaymentStatus, PaymentTransaction } from './types.js';

export type CallbackDecision =
  /** Signature failed verification — reject (400), record rejected_callback, order unchanged. */
  | { kind: 'reject'; reason: string }
  /** Authentic success, not yet applied — apply exactly once (confirm inventory, emit events). */
  | { kind: 'apply' }
  /** Authentic success but already applied — return 200 without re-applying (Req 11.7). */
  | { kind: 'duplicate' }
  /** Authentic failure callback — keep sub-orders PENDING, retain reservations (Req 11.4). */
  | { kind: 'failure' };

export interface ClassifyInput {
  /** The existing transaction for this txnId, or null when unknown. */
  txn: PaymentTransaction | null;
  /** Whether the callback signature verified against the provider secret. */
  authentic: boolean;
  /** Provider-reported outcome. */
  reportedStatus: 'success' | 'failed';
  /** Provider named in the callback path. */
  callbackProvider: string;
}

/**
 * Classify an incoming callback into the action the gateway must take.
 *
 * Authenticity is the first gate: an inauthentic callback is always rejected and never alters the
 * order (Req 11.8). An authentic success on an already-applied transaction is a duplicate and is a
 * no-op (Req 11.7).
 */
export function classifyCallback(input: ClassifyInput): CallbackDecision {
  const { txn, authentic, reportedStatus, callbackProvider } = input;

  if (txn === null) {
    return { kind: 'reject', reason: 'UNKNOWN_TRANSACTION' };
  }
  // The callback must arrive on the same provider the transaction was bound to (Req 11.1).
  if (txn.provider !== callbackProvider) {
    return { kind: 'reject', reason: 'PROVIDER_MISMATCH' };
  }
  if (!authentic) {
    return { kind: 'reject', reason: 'INVALID_SIGNATURE' };
  }
  if (reportedStatus === 'failed') {
    return { kind: 'failure' };
  }
  // Authentic success.
  if (txn.applied) {
    return { kind: 'duplicate' };
  }
  return { kind: 'apply' };
}

/** Terminal statuses that an authentic-success application can resolve a transaction to. */
export const APPLY_OUTCOME: Record<'confirmed' | 'insufficient', PaymentStatus> = {
  confirmed: 'SUCCESS',
  insufficient: 'NEEDS_RECONCILIATION',
};
