-- Payment Gateway schema (design: Deep-Dive 4 → Payment Flow; Req 11, 19.4).
-- Idempotent: safe to re-run. All objects live in the dedicated `payment` schema.

CREATE SCHEMA IF NOT EXISTS payment;

-- PAYMENT_TRANSACTION — one row per initiated transaction, keyed by a unique txn id.
-- Bound to exactly one provider; `applied` enforces single-application of authentic success
-- callbacks (Req 11.1, 11.2, 11.7).
CREATE TABLE IF NOT EXISTS payment.payment_transaction (
    txn_id      TEXT PRIMARY KEY,
    order_id    TEXT NOT NULL,
    provider    TEXT NOT NULL CHECK (provider IN ('bkash', 'nagad', 'sslcommerz')),
    amount      NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    status      TEXT NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'TIMED_OUT', 'NEEDS_RECONCILIATION')),
    applied     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Look up open/pending transactions for the timeout sweep (Req 11.4).
CREATE INDEX IF NOT EXISTS payment_txn_status_idx
    ON payment.payment_transaction (status, applied, created_at);
CREATE INDEX IF NOT EXISTS payment_txn_order_idx
    ON payment.payment_transaction (order_id);

-- REJECTED_CALLBACK — audit of callbacks that failed authenticity verification (Req 11.8).
CREATE TABLE IF NOT EXISTS payment.rejected_callback (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider    TEXT NOT NULL,
    txn_id      TEXT,
    reason      TEXT NOT NULL,
    payload     JSONB NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rejected_callback_txn_idx ON payment.rejected_callback (txn_id);
CREATE INDEX IF NOT EXISTS rejected_callback_time_idx ON payment.rejected_callback (received_at DESC);
