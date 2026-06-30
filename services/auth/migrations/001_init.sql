-- Auth Service schema (design: Data Models → Auth Service; Req 1, 16.2, 19.1, 19.5).
-- Idempotent: safe to re-run. All objects live in the dedicated `auth` schema.

CREATE SCHEMA IF NOT EXISTS auth;

-- USERS — one row per registered business user (Req 1.1, 2.5).
CREATE TABLE IF NOT EXISTS auth.users (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                       TEXT NOT NULL,
    password_hash               TEXT NOT NULL,
    business_name               TEXT NOT NULL,
    role                        TEXT NOT NULL CHECK (role IN ('SUPPLIER', 'RETAILER', 'ADMINISTRATOR')),
    status                      TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION'
                                    CHECK (status IN ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'LOCKED')),
    preferred_language          TEXT NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'bn')),
    email_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    locked_until                TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case-insensitive uniqueness of email (Req 1.2).
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uk ON auth.users (lower(email));

-- REFRESH_TOKENS — opaque tokens stored hashed; rotated/revocable (Req 1.6, 1.9, 16.2).
CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    revoked     BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON auth.refresh_tokens (user_id) WHERE revoked = FALSE;

-- LOGIN_ATTEMPTS — drives the consecutive-failure lockout window (Req 1.7).
CREATE TABLE IF NOT EXISTS auth.login_attempts (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    success      BOOLEAN NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_attempts_user_time_idx ON auth.login_attempts (user_id, attempted_at DESC);

-- AUDIT_LOG — append-only record of auth/authorization events (Req 19.5).
CREATE TABLE IF NOT EXISTS auth.audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    event_type  TEXT NOT NULL,
    detail      JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_user_idx ON auth.audit_log (user_id);
CREATE INDEX IF NOT EXISTS audit_log_event_idx ON auth.audit_log (event_type);

-- Enforce immutability of audit rows: block UPDATE and DELETE (Req 19.5).
CREATE OR REPLACE FUNCTION auth.audit_log_immutable() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'auth.audit_log is append-only; % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_update ON auth.audit_log;
CREATE TRIGGER audit_log_no_update
    BEFORE UPDATE OR DELETE ON auth.audit_log
    FOR EACH ROW EXECUTE FUNCTION auth.audit_log_immutable();
