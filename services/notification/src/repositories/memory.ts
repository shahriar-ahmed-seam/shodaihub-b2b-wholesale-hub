/**
 * In-memory repository implementations.
 *
 * Used by the test-suite (and as a no-DB fallback) so the full service behaviour — including the
 * Property 42 retry suite — can run without a live Postgres. Semantics mirror the `pg`-backed
 * implementations.
 */

import { randomUUID } from 'node:crypto';
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

export class InMemoryNotificationRepository implements NotificationRepository {
  private readonly byId = new Map<string, NotificationRecord>();

  async create(notification: NewNotification): Promise<NotificationRecord> {
    const record: NotificationRecord = {
      id: randomUUID(),
      userId: notification.userId,
      type: notification.type,
      channel: notification.channel,
      lang: notification.lang,
      payload: notification.payload,
      status: notification.status,
      attempts: 0,
      createdAt: Date.now(),
    };
    this.byId.set(record.id, record);
    return { ...record };
  }

  async updateDelivery(id: string, status: NotificationStatus, attempts: number): Promise<void> {
    const record = this.byId.get(id);
    if (record) {
      record.status = status;
      record.attempts = attempts;
    }
  }

  async findById(id: string): Promise<NotificationRecord | null> {
    const record = this.byId.get(id);
    return record ? { ...record } : null;
  }

  async listForUser(userId: string): Promise<NotificationRecord[]> {
    return [...this.byId.values()].filter((r) => r.userId === userId).map((r) => ({ ...r }));
  }

  /** Test accessor: every stored notification row. */
  async listAll(): Promise<NotificationRecord[]> {
    return [...this.byId.values()].map((r) => ({ ...r }));
  }
}

export class InMemoryDedupRepository implements DedupRepository {
  private readonly seen = new Map<string, number>();

  async markProcessed(eventId: string, processedAt: number): Promise<boolean> {
    if (this.seen.has(eventId)) return false;
    this.seen.set(eventId, processedAt);
    return true;
  }

  async hasProcessed(eventId: string): Promise<boolean> {
    return this.seen.has(eventId);
  }
}

export class InMemoryDeadLetterRepository implements DeadLetterRepository {
  private readonly entries: DeadLetterRecord[] = [];

  async record(
    entry: Omit<DeadLetterRecord, 'id' | 'createdAt'>,
    createdAt: number,
  ): Promise<DeadLetterRecord> {
    const record: DeadLetterRecord = { id: randomUUID(), createdAt, ...entry };
    this.entries.push(record);
    return { ...record };
  }

  async list(): Promise<DeadLetterRecord[]> {
    return this.entries.map((e) => ({ ...e }));
  }
}

export function createInMemoryRepositories(): Repositories & {
  notifications: InMemoryNotificationRepository;
  dedup: InMemoryDedupRepository;
  deadLetters: InMemoryDeadLetterRepository;
} {
  return {
    notifications: new InMemoryNotificationRepository(),
    dedup: new InMemoryDedupRepository(),
    deadLetters: new InMemoryDeadLetterRepository(),
  };
}
