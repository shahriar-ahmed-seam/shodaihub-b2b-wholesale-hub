/**
 * Core payment domain types shared by the service, repositories, and routes.
 */

import type { Provider } from './providers.js';

/**
 * Lifecycle of a payment transaction.
 *
 * - `PENDING`            — initiated; awaiting an authenticated provider callback (Req 11.2, 11.4).
 * - `SUCCESS`           — authenticated success applied; reservations converted, sub-orders CONFIRMED (Req 11.3).
 * - `FAILED`            — authenticated failure callback received; sub-orders stay PENDING (Req 11.4).
 * - `TIMED_OUT`         — no authenticated success within the timeout window; reservations expire (Req 11.4).
 * - `NEEDS_RECONCILIATION` — late authenticated success but sellable stock insufficient (Req 11.9).
 */
export type PaymentStatus =
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'TIMED_OUT'
  | 'NEEDS_RECONCILIATION';

/** A persisted payment transaction (one row per `txnId`). */
export interface PaymentTransaction {
  txnId: string;
  orderId: string;
  provider: Provider;
  /** Canonical BDT amount string for the full order total (Req 11.2). */
  amount: string;
  status: PaymentStatus;
  /** Idempotency flag — true once an authenticated success has been applied (Req 11.7). */
  applied: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Fields needed to create a transaction at initiation time. */
export interface NewPaymentTransaction {
  txnId: string;
  orderId: string;
  provider: Provider;
  amount: string;
}

/** A persisted record of a callback that failed authenticity verification (Req 11.8). */
export interface RejectedCallback {
  id: string;
  provider: string;
  txnId: string | null;
  reason: string;
  /** Raw payload as received, retained for audit. */
  payload: Record<string, unknown>;
  receivedAt: number;
}
