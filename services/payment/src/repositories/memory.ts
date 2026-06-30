/**
 * In-memory repository implementations.
 *
 * Used by the test-suite (and as a fallback when no Postgres is reachable) so the full service
 * behaviour — including the property-based suites — can be exercised without a live database. The
 * atomic-claim semantics mirror the `pg`-backed conditional UPDATE.
 */

import { randomUUID } from 'node:crypto';
import type {
  NewPaymentTransaction,
  PaymentStatus,
  PaymentTransaction,
  RejectedCallback,
} from '../domain/types.js';
import type {
  PaymentTransactionRepository,
  RejectedCallbackRepository,
  Repositories,
} from './types.js';

export class InMemoryPaymentTransactionRepository implements PaymentTransactionRepository {
  private readonly byTxnId = new Map<string, PaymentTransaction>();

  async create(txn: NewPaymentTransaction, createdAt: number): Promise<PaymentTransaction> {
    if (this.byTxnId.has(txn.txnId)) {
      throw new Error(`duplicate txnId: ${txn.txnId}`);
    }
    const record: PaymentTransaction = {
      txnId: txn.txnId,
      orderId: txn.orderId,
      provider: txn.provider,
      amount: txn.amount,
      status: 'PENDING',
      applied: false,
      createdAt,
      updatedAt: createdAt,
    };
    this.byTxnId.set(record.txnId, record);
    return { ...record };
  }

  async findByTxnId(txnId: string): Promise<PaymentTransaction | null> {
    const record = this.byTxnId.get(txnId);
    return record ? { ...record } : null;
  }

  async claimApplication(txnId: string, now: number): Promise<boolean> {
    const record = this.byTxnId.get(txnId);
    if (!record) return false;
    // Conditional, single-step claim: only succeeds when not already applied (Req 11.7).
    if (record.applied) return false;
    record.applied = true;
    record.updatedAt = now;
    return true;
  }

  async releaseApplication(txnId: string, now: number): Promise<void> {
    const record = this.byTxnId.get(txnId);
    if (record) {
      record.applied = false;
      record.status = 'PENDING';
      record.updatedAt = now;
    }
  }

  async updateStatus(txnId: string, status: PaymentStatus, now: number): Promise<void> {
    const record = this.byTxnId.get(txnId);
    if (record) {
      record.status = status;
      record.updatedAt = now;
    }
  }

  async timeoutStale(olderThanMs: number, now: number): Promise<string[]> {
    const cutoff = now - olderThanMs;
    const timedOut: string[] = [];
    for (const record of this.byTxnId.values()) {
      if (record.status === 'PENDING' && !record.applied && record.createdAt < cutoff) {
        record.status = 'TIMED_OUT';
        record.updatedAt = now;
        timedOut.push(record.txnId);
      }
    }
    return timedOut;
  }
}

export class InMemoryRejectedCallbackRepository implements RejectedCallbackRepository {
  private readonly entries: RejectedCallback[] = [];

  async record(
    provider: string,
    txnId: string | null,
    reason: string,
    payload: Record<string, unknown>,
    receivedAt: number,
  ): Promise<RejectedCallback> {
    const record: RejectedCallback = {
      id: randomUUID(),
      provider,
      txnId,
      reason,
      payload,
      receivedAt,
    };
    this.entries.push(record);
    return { ...record };
  }

  async list(): Promise<RejectedCallback[]> {
    return this.entries.map((e) => ({ ...e }));
  }
}

export function createInMemoryRepositories(): Repositories & {
  transactions: InMemoryPaymentTransactionRepository;
  rejectedCallbacks: InMemoryRejectedCallbackRepository;
} {
  return {
    transactions: new InMemoryPaymentTransactionRepository(),
    rejectedCallbacks: new InMemoryRejectedCallbackRepository(),
  };
}
