/**
 * Postgres-backed repository implementations (design: Data Models → Notification).
 *
 * These wire the service to the `notifications` schema. Dedup uses an
 * `INSERT ... ON CONFLICT DO NOTHING` so concurrent consumers cannot double-process an event id.
 */

import type pg from 'pg';
import type { ChannelName } from '../channels/types.js';
import type {
  DeadLetterRecord,
  DeadLetterRepository,
  DedupRepository,
  NewNotification,
  NotificationRecord,
  NotificationRepository,
  NotificationStatus,
  Repositories,
} from './types.js';

function toEpoch(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  channel: ChannelName;
  lang: string;
  payload: Record<string, unknown>;
  status: NotificationStatus;
  attempts: number;
  created_at: Date | string;
}

function mapNotification(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    channel: row.channel,
    lang: row.lang,
    payload: row.payload ?? {},
    status: row.status,
    attempts: row.attempts,
    createdAt: toEpoch(row.created_at),
  };
}

export class PgNotificationRepository implements NotificationRepository {
  constructor(private readonly pool: pg.Pool) {}

  async create(notification: NewNotification): Promise<NotificationRecord> {
    const { rows } = await this.pool.query<NotificationRow>(
      `INSERT INTO notifications.notifications (user_id, type, channel, lang, payload, status)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       RETURNING *`,
      [
        notification.userId,
        notification.type,
        notification.channel,
        notification.lang,
        JSON.stringify(notification.payload ?? {}),
        notification.status,
      ],
    );
    return mapNotification(rows[0]!);
  }

  async updateDelivery(id: string, status: NotificationStatus, attempts: number): Promise<void> {
    await this.pool.query(
      `UPDATE notifications.notifications SET status = $2, attempts = $3 WHERE id = $1`,
      [id, status, attempts],
    );
  }

  async findById(id: string): Promise<NotificationRecord | null> {
    const { rows } = await this.pool.query<NotificationRow>(
      `SELECT * FROM notifications.notifications WHERE id = $1`,
      [id],
    );
    return rows[0] ? mapNotification(rows[0]) : null;
  }

  async listForUser(userId: string): Promise<NotificationRecord[]> {
    const { rows } = await this.pool.query<NotificationRow>(
      `SELECT * FROM notifications.notifications WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    return rows.map(mapNotification);
  }
}

export class PgDedupRepository implements DedupRepository {
  constructor(private readonly pool: pg.Pool) {}

  async markProcessed(eventId: string, processedAt: number): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `INSERT INTO notifications.processed_events (event_id, processed_at)
       VALUES ($1, $2) ON CONFLICT (event_id) DO NOTHING`,
      [eventId, new Date(processedAt)],
    );
    return (rowCount ?? 0) > 0;
  }

  async hasProcessed(eventId: string): Promise<boolean> {
    const { rows } = await this.pool.query(
      `SELECT 1 FROM notifications.processed_events WHERE event_id = $1`,
      [eventId],
    );
    return rows.length > 0;
  }
}

export class PgDeadLetterRepository implements DeadLetterRepository {
  constructor(private readonly pool: pg.Pool) {}

  async record(
    entry: Omit<DeadLetterRecord, 'id' | 'createdAt'>,
    createdAt: number,
  ): Promise<DeadLetterRecord> {
    const { rows } = await this.pool.query(
      `INSERT INTO notifications.dead_letters (event_id, user_id, type, channel, payload, reason, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
       RETURNING id, event_id, user_id, type, channel, payload, reason, created_at`,
      [
        entry.eventId,
        entry.userId,
        entry.type,
        entry.channel,
        JSON.stringify(entry.payload ?? {}),
        entry.reason,
        new Date(createdAt),
      ],
    );
    const row = rows[0]!;
    return {
      id: row.id,
      eventId: row.event_id,
      userId: row.user_id,
      type: row.type,
      channel: row.channel,
      payload: row.payload ?? {},
      reason: row.reason,
      createdAt: toEpoch(row.created_at),
    };
  }

  async list(): Promise<DeadLetterRecord[]> {
    const { rows } = await this.pool.query(
      `SELECT id, event_id, user_id, type, channel, payload, reason, created_at
       FROM notifications.dead_letters ORDER BY created_at DESC`,
    );
    return rows.map((row) => ({
      id: row.id,
      eventId: row.event_id,
      userId: row.user_id,
      type: row.type,
      channel: row.channel,
      payload: row.payload ?? {},
      reason: row.reason,
      createdAt: toEpoch(row.created_at),
    }));
  }
}

export function createPgRepositories(pool: pg.Pool): Repositories {
  return {
    notifications: new PgNotificationRepository(pool),
    dedup: new PgDedupRepository(pool),
    deadLetters: new PgDeadLetterRepository(pool),
  };
}
