/**
 * Payment Gateway service layer (design: Deep-Dive 4 → Payment Flow).
 *
 * Orchestrates the pure decision logic (provider binding, signature verification, idempotency
 * classification) with the repository abstraction, the Inventory client, and the event publisher.
 * All collaborators are injected so the whole flow is testable against in-memory fakes.
 *
 * Covers: initiation binding one provider for the full BDT total (Req 11.1, 11.2); authentic +
 * idempotent callback application (Req 11.6, 11.7, 11.8); confirm-to-inventory on success with
 * failure/timeout/reconciliation handling (Req 11.3, 11.4, 11.5, 11.9).
 */

import { randomUUID } from 'node:crypto';
import { AppError, HttpStatus, type Logger } from '@b2b/shared-node';
import type { InventoryClient } from '../clients/inventoryClient.js';
import { bindProvider, type Provider } from '../domain/providers.js';
import { classifyCallback } from '../domain/idempotency.js';
import { CURRENCY, normalizeBdt } from '../domain/money.js';
import type { CallbackPayload } from '../domain/signature.js';
import type { PaymentTransaction } from '../domain/types.js';
import { generateTxnId } from '../domain/txnId.js';
import { NOTIFICATIONS_STREAM, type NotificationEvent } from '../events/types.js';
import type { EventPublisher } from '../events/publisher.js';
import type { ProviderRegistry } from '../providers/registry.js';
import type { Repositories } from '../repositories/types.js';
import type { Clock } from './clock.js';

export interface PaymentServiceDeps {
  repositories: Repositories;
  providers: ProviderRegistry;
  inventory: InventoryClient;
  events: EventPublisher;
  clock: Clock;
  logger?: Logger;
  /** Initiation→success timeout in ms before a sweep times the transaction out (Req 11.4). */
  timeoutMs: number;
}

export interface InitiateInput {
  orderId: unknown;
  provider: unknown;
}

export interface InitiateResult {
  txnId: string;
  orderId: string;
  provider: Provider;
  amount: string;
  currency: typeof CURRENCY;
  status: PaymentTransaction['status'];
  checkoutUrl: string;
}

export interface CallbackInput {
  /** Provider named in the callback path (`/payments/callback/{provider}`). */
  provider: string;
  body: Record<string, unknown>;
  correlationId: string;
}

export interface CallbackResult {
  /** HTTP status the route should return. */
  httpStatus: number;
  applied: boolean;
  status: PaymentTransaction['status'] | null;
  outcome: 'applied' | 'duplicate' | 'failure' | 'rejected';
  reason?: string;
}

export class PaymentService {
  constructor(private readonly deps: PaymentServiceDeps) {}

  /**
   * Initiate a payment: fetch the order total from Inventory, create a transaction bound to exactly
   * one provider for the full total in BDT with a unique txn id, and return the checkout URL
   * (Req 11.1, 11.2).
   */
  async initiate(input: InitiateInput, correlationId: string): Promise<InitiateResult> {
    const orderId = this.requireOrderId(input.orderId);
    const provider = bindProvider(input.provider); // exactly one supported provider (Req 11.1)

    const total = await this.deps.inventory.getOrderTotal(orderId, correlationId);
    if (total.currency !== CURRENCY) {
      throw new AppError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'INVALID_CURRENCY',
        `Order total must be in ${CURRENCY}`,
      );
    }
    const amount = normalizeBdt(total.amount); // full order total in BDT (Req 11.2)

    const now = this.deps.clock.now();
    const txnId = generateTxnId(); // unique transaction id (Req 11.2)
    const txn = await this.deps.repositories.transactions.create(
      { txnId, orderId, provider, amount },
      now,
    );

    const adapter = this.deps.providers.get(provider);
    const { checkoutUrl } = await adapter.createCheckout({ txnId, orderId, amount });

    this.deps.logger?.info('Payment initiated', { txnId, orderId, provider, amount });
    return {
      txnId: txn.txnId,
      orderId: txn.orderId,
      provider: txn.provider,
      amount: txn.amount,
      currency: CURRENCY,
      status: txn.status,
      checkoutUrl,
    };
  }

  /**
   * Handle a provider callback: verify authenticity, then apply the result at most once.
   *
   * - Inauthentic / unknown / provider-mismatch → reject (400), record rejected_callback, order
   *   unchanged (Req 11.6, 11.8).
   * - Authentic failure → keep sub-orders PENDING, retain reservations (Req 11.4).
   * - Authentic success, first time → confirm with Inventory, convert reservations, emit events
   *   (Req 11.3, 11.5); if reservations expired and stock insufficient, flag for reconciliation
   *   (Req 11.9).
   * - Authentic success, duplicate → 200 without re-applying (Req 11.7).
   */
  async handleCallback(input: CallbackInput): Promise<CallbackResult> {
    const now = this.deps.clock.now();
    const payload = this.parsePayload(input.body);
    const txn = payload ? await this.deps.repositories.transactions.findByTxnId(payload.txnId) : null;

    // Verify authenticity against the bound provider's secret (Req 11.6).
    let authentic = false;
    if (payload && txn && txn.provider === input.provider) {
      authentic = this.deps.providers.get(txn.provider).verify(payload, input.body.signature);
    }

    const decision = classifyCallback({
      txn,
      authentic,
      reportedStatus: payload?.status ?? 'failed',
      callbackProvider: input.provider,
    });

    switch (decision.kind) {
      case 'reject': {
        await this.deps.repositories.rejectedCallbacks.record(
          input.provider,
          payload?.txnId ?? null,
          decision.reason,
          input.body,
          now,
        );
        this.deps.logger?.warn('Rejected payment callback', {
          provider: input.provider,
          reason: decision.reason,
        });
        // Authenticity / validity failures are 400 (design: HTTP Status Conventions, Req 11.8).
        return {
          httpStatus: HttpStatus.BAD_REQUEST,
          applied: false,
          status: txn?.status ?? null,
          outcome: 'rejected',
          reason: decision.reason,
        };
      }

      case 'failure': {
        // Authentic failure: keep PENDING + retain reservations (Req 11.4). Record FAILED status.
        await this.deps.repositories.transactions.updateStatus(txn!.txnId, 'FAILED', now);
        return {
          httpStatus: HttpStatus.OK,
          applied: false,
          status: 'FAILED',
          outcome: 'failure',
        };
      }

      case 'duplicate': {
        // Already applied — idempotent no-op (Req 11.7).
        return {
          httpStatus: HttpStatus.OK,
          applied: true,
          status: txn!.status,
          outcome: 'duplicate',
        };
      }

      case 'apply': {
        return this.applySuccess(txn!, input.correlationId, now);
      }
    }
  }

  /** Apply an authentic success exactly once and confirm with Inventory (Req 11.3, 11.5, 11.9). */
  private async applySuccess(
    txn: PaymentTransaction,
    correlationId: string,
    now: number,
  ): Promise<CallbackResult> {
    // Atomic claim guarantees only the first authentic success proceeds (Req 11.7).
    const claimed = await this.deps.repositories.transactions.claimApplication(txn.txnId, now);
    if (!claimed) {
      const current = await this.deps.repositories.transactions.findByTxnId(txn.txnId);
      return {
        httpStatus: HttpStatus.OK,
        applied: true,
        status: current?.status ?? txn.status,
        outcome: 'duplicate',
      };
    }

    let confirm;
    try {
      confirm = await this.deps.inventory.confirmOrder(txn.orderId, txn.txnId, correlationId);
    } catch (err) {
      // Downstream failure: release the claim so the result can be re-applied later (Req 11.4).
      await this.deps.repositories.transactions.releaseApplication(txn.txnId, this.deps.clock.now());
      this.deps.logger?.error('Inventory confirm failed; released application claim', {
        txnId: txn.txnId,
        error: String(err),
      });
      throw err;
    }

    if (confirm.outcome === 'INSUFFICIENT_STOCK') {
      // Late success after reservations expired + insufficient stock (Req 11.9): keep sub-orders
      // PENDING (Inventory side) and flag the transaction for reconciliation.
      await this.deps.repositories.transactions.updateStatus(
        txn.txnId,
        'NEEDS_RECONCILIATION',
        this.deps.clock.now(),
      );
      this.deps.logger?.warn('Payment success needs reconciliation', { txnId: txn.txnId });
      return {
        httpStatus: HttpStatus.OK,
        applied: true,
        status: 'NEEDS_RECONCILIATION',
        outcome: 'applied',
        reason: 'NEEDS_RECONCILIATION',
      };
    }

    // CONFIRMED: reservations converted to permanent decrements; sub-orders CONFIRMED (Req 11.3).
    await this.deps.repositories.transactions.updateStatus(txn.txnId, 'SUCCESS', this.deps.clock.now());
    await this.emitSuccessNotifications(txn, confirm.retailerId, confirm.supplierIds ?? [], correlationId);
    this.deps.logger?.info('Payment confirmed', { txnId: txn.txnId, orderId: txn.orderId });

    return {
      httpStatus: HttpStatus.OK,
      applied: true,
      status: 'SUCCESS',
      outcome: 'applied',
    };
  }

  /** Emit the payment-confirmation + new-order notifications on success (Req 11.5). */
  private async emitSuccessNotifications(
    txn: PaymentTransaction,
    retailerId: string | undefined,
    supplierIds: string[],
    correlationId: string,
  ): Promise<void> {
    const base = { orderId: txn.orderId, txnId: txn.txnId, amount: txn.amount, currency: CURRENCY };

    if (retailerId) {
      const event: NotificationEvent = {
        eventId: randomUUID(),
        userId: retailerId,
        type: 'PAYMENT_CONFIRMED',
        data: base,
        correlationId,
      };
      await this.deps.events.publish(NOTIFICATIONS_STREAM, event);
    }
    for (const supplierId of supplierIds) {
      const event: NotificationEvent = {
        eventId: randomUUID(),
        userId: supplierId,
        type: 'NEW_ORDER',
        data: base,
        correlationId,
      };
      await this.deps.events.publish(NOTIFICATIONS_STREAM, event);
    }
  }

  /** Return the current status of a transaction (Req 11.4 — `GET /payments/{txnId}`). */
  async getStatus(txnId: string): Promise<PaymentTransaction> {
    const txn = await this.deps.repositories.transactions.findByTxnId(txnId);
    if (!txn) {
      throw new AppError(HttpStatus.NOT_FOUND, 'TXN_NOT_FOUND', `Unknown transaction: ${txnId}`);
    }
    return txn;
  }

  /**
   * Sweep stale initiations: transactions with no authenticated success within the timeout window
   * become TIMED_OUT so sub-orders stay PENDING and reservations expire naturally (Req 11.4).
   * Returns the timed-out txnIds.
   */
  async sweepTimeouts(): Promise<string[]> {
    const now = this.deps.clock.now();
    return this.deps.repositories.transactions.timeoutStale(this.deps.timeoutMs, now);
  }

  private requireOrderId(value: unknown): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new AppError(HttpStatus.UNPROCESSABLE_ENTITY, 'INVALID_ORDER', 'orderId is required', [
        { field: 'orderId', issue: 'missing or empty order id' },
      ]);
    }
    return value.trim();
  }

  /** Extract and validate the signed business fields from a raw callback body. */
  private parsePayload(body: Record<string, unknown>): CallbackPayload | null {
    const txnId = body.txnId;
    const orderId = body.orderId;
    const rawStatus = body.status;
    const amount = body.amount;
    if (typeof txnId !== 'string' || txnId.length === 0) return null;
    if (typeof orderId !== 'string') return null;
    if (rawStatus !== 'success' && rawStatus !== 'failed') return null;
    if (typeof amount !== 'string' && typeof amount !== 'number') return null;
    return {
      txnId,
      orderId,
      status: rawStatus,
      amount: typeof amount === 'number' ? amount.toFixed(2) : amount,
    };
  }
}
