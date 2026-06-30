/**
 * Postgres-backed repository implementations (`pg` driver).
 *
 * Mirror the semantics of the in-memory fakes. The single-application invariant (Req 11.7) is
 * enforced by a conditional UPDATE (`SET applied = TRUE WHERE applied = FALSE`) whose row count
 * tells the caller whether THIS request performed the claim. Amounts are stored as `NUMERIC(12,2)`
 * and surfaced as canonical strings; timestamps are `TIMESTAMPTZ` surfaced as epoch ms. All
 * statements are parameterized (Req 19.3).
 */

import type pg from 'pg';
import type { Provider } from '../domain/providers.js';
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

interface TxnRow {
  txn_id: string;
  order_id: string;
  provider: Provider;
  amount: string;
  status: PaymentStatus;
  applied: boolean;
  created_at: Date;
  updated_at: Date;
}

function mapTxn(row: TxnRow): PaymentTransaction {
  return {
    txnId: row.txn_id,
    orderId: row.order_id,
    provider: row.provider,
    // NUMERIC comes back as a string from `pg`; normalize to 2 decimals.
    amount: Number.parseFloat(row.amount).toFixed(2),
    status: row.status,
    applied: row.applied,
    createdAt: row.created_at.getTime(),
    updatedAt: row.updated_at.getTime(),
  };
}

export class PgPaymentTransactionRepository implements PaymentTransactionRepository {
  constructor(private readonly pool: pg.Pool) {}

  async create(txn: NewPaymentTransaction, createdAt: number): Promise<PaymentTransaction> {
    const ts = new Date(createdAt);
    const { rows } = await this.pool.query<TxnRow>(
      `INSERT INTO payment.payment_transaction
         (txn_id, order_id, provider, amount, status, applied, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'PENDING', FALSE, $5, $5)
       RETURNING *`,
      [txn.txnId, txn.orderId, txn.provider, txn.amount, ts],
    );
    return mapTxn(rows[0]!);
  }

  async findByTxnId(txnId: string): Promise<PaymentTransaction | null> {
    const { rows } = await this.pool.query<TxnRow>(
      'SELECT * FROM payment.payment_transaction WHERE txn_id = $1',
      [txnId],
    );
    return rows[0] ? mapTxn(rows[0]) : null;
  }

  async claimApplication(txnId: string, now: number): Promise<boolean> {
    // Atomic claim: only the first authentic success flips applied FALSE -> TRUE (Req 11.7).
    const { rowCount } = await this.pool.query(
      `UPDATE payment.payment_transaction
          SET applied = TRUE, updated_at = $2
        WHERE txn_id = $1 AND applied = FALSE`,
      [txnId, new Date(now)],
    );
    return (rowCount ?? 0) === 1;
  }

  async releaseApplication(txnId: string, now: number): Promise<void> {
    await this.pool.query(
      `UPDATE payment.payment_transaction
          SET applied = FALSE, status = 'PENDING', updated_at = $2
        WHERE txn_id = $1`,
      [txnId, new Date(now)],
    );
  }

  async updateStatus(txnId: string, status: PaymentStatus, now: number): Promise<void> {
    await this.pool.query(
      'UPDATE payment.payment_transaction SET status = $2, updated_at = $3 WHERE txn_id = $1',
      [txnId, status, new Date(now)],
    );
  }

  async timeoutStale(olderThanMs: number, now: number): Promise<string[]> {
    const cutoff = new Date(now - olderThanMs);
    const { rows } = await this.pool.query<{ txn_id: string }>(
      `UPDATE payment.payment_transaction
          SET status = 'TIMED_OUT', updated_at = $2
        WHERE status = 'PENDING' AND applied = FALSE AND created_at < $1
        RETURNING txn_id`,
      [cutoff, new Date(now)],
    );
    return rows.map((r) => r.txn_id);
  }
}

interface RejectedRow {
  id: string;
  provider: string;
  txn_id: string | null;
  reason: string;
  payload: Record<string, unknown>;
  received_at: Date;
}

export class PgRejectedCallbackRepository implements RejectedCallbackRepository {
  constructor(private readonly pool: pg.Pool) {}

  async record(
    provider: string,
    txnId: string | null,
    reason: string,
    payload: Record<string, unknown>,
    receivedAt: number,
  ): Promise<RejectedCallback> {
    const { rows } = await this.pool.query<RejectedRow>(
      `INSERT INTO payment.rejected_callback (provider, txn_id, reason, payload, received_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [provider, txnId, reason, JSON.stringify(payload), new Date(receivedAt)],
    );
    const row = rows[0]!;
    return {
      id: row.id,
      provider: row.provider,
      txnId: row.txn_id,
      reason: row.reason,
      payload: row.payload,
      receivedAt: row.received_at.getTime(),
    };
  }

  async list(): Promise<RejectedCallback[]> {
    const { rows } = await this.pool.query<RejectedRow>(
      'SELECT * FROM payment.rejected_callback ORDER BY received_at ASC',
    );
    return rows.map((row) => ({
      id: row.id,
      provider: row.provider,
      txnId: row.txn_id,
      reason: row.reason,
      payload: row.payload,
      receivedAt: row.received_at.getTime(),
    }));
  }
}

export function createPgRepositories(pool: pg.Pool): Repositories {
  return {
    transactions: new PgPaymentTransactionRepository(pool),
    rejectedCallbacks: new PgRejectedCallbackRepository(pool),
  };
}
