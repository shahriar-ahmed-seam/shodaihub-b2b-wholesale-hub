-- Notification Service schema (design: Data Models → Notification; Req 14.1–14.4).
-- Idempotent: safe to re-run. All objects live in the dedicated `notifications` schema.

CREATE SCHEMA IF NOT EXISTS notifications;

-- NOTIFICATIONS — one row per (event, channel) delivery (Req 14.1, 14.2, 14.4).
CREATE TABLE IF NOT EXISTS notifications.notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL,
    type        TEXT NOT NULL,
    channel     TEXT NOT NULL CHECK (channel IN ('IN_APP', 'EMAIL', 'SMS')),
    lang        TEXT NOT NULL DEFAULT 'en' CHECK (lang IN ('en', 'bn')),
    payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
    status      TEXT NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'DELIVERED', 'FAILED', 'DEAD_LETTER')),
    attempts    INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_status_idx ON notifications.notifications (status);

-- PROCESSED_EVENTS — dedup by event id so at-least-once stream delivery is idempotent
-- (design: Internal Eventing → "notification dedup by event id").
CREATE TABLE IF NOT EXISTS notifications.processed_events (
    event_id     TEXT PRIMARY KEY,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- DEAD_LETTERS — messages whose delivery exhausted all retries (Req 14.3, dead-letter).
CREATE TABLE IF NOT EXISTS notifications.dead_letters (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    TEXT NOT NULL,
    user_id     UUID NOT NULL,
    type        TEXT NOT NULL,
    channel     TEXT NOT NULL CHECK (channel IN ('IN_APP', 'EMAIL', 'SMS')),
    payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
    reason      TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dead_letters_event_idx ON notifications.dead_letters (event_id);
