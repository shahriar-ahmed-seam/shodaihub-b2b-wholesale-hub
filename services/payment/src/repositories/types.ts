/**
 * Repository abstractions for the Payment Gateway.
 *
 * The service layer depends only on these interfaces so its logic (initiation, authentic +
 * idempotent callback application, timeout sweep) can be property-tested against in-memory fakes
 * without a live Postgres, while production wires the `pg`-backed implementations.
 */

import type {
  NewPaymentTransaction,
  PaymentStatus,
  PaymentTransaction,
  RejectedCallback,
} from '../domain/types.js';

export interface PaymentTransactionRepository {
  /** Create a PENDING, not-yet-applied transaction bound to one provider (Req 11.2). */
  create(txn: NewPaymentTransaction, createdAt: number): Promise<PaymentTransaction>;

  findByTxnId(txnId: string): Promise<PaymentTransaction | null>;

  /**
   * Atomically claim the right to apply an authentic success exactly once (Req 11.7).
   *
   * Sets `applied = true` only when it was previously false, in a single statement
   * (insert-on-conflict / conditional update). Returns true when THIS call performed the claim,
   * false when the transaction was already applied (a duplicate callback).
   */
  claimApplication(txnId: string, now: number): Promise<boolean>;

  /** Revert a claim (set `applied = false`, status PENDING) if downstream confirmation failed. */
  releaseApplication(txnId: string, now: number): Promise<void>;

  /** Update the terminal/working status of a transaction. */
  updateStatus(txnId: string, status: PaymentStatus, now: number): Promise<void>;

  /**
   * Time out stale initiations: PENDING + not-applied transactions created before `now - olderThanMs`
   * become TIMED_OUT so sub-orders stay PENDING and reservations expire naturally (Req 11.4).
   * Returns the txnIds that were timed out.
   */
  timeoutStale(olderThanMs: number, now: number): Promise<string[]>;
}

export interface RejectedCallbackRepository {
  /** Persist a callback that failed authenticity verification (Req 11.8). */
  record(
    provider: string,
    txnId: string | null,
    reason: string,
    payload: Record<string, unknown>,
    receivedAt: number,
  ): Promise<RejectedCallback>;

  /** Read-only accessor (audit). */
  list(): Promise<RejectedCallback[]>;
}

export interface Repositories {
  transactions: PaymentTransactionRepository;
  rejectedCallbacks: RejectedCallbackRepository;
}
