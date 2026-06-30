/**
 * Repository abstractions for the Notification Service.
 *
 * The service layer depends only on these interfaces so its logic (dedup, render, deliver, retry,
 * failure recording) can be exercised against in-memory fakes without a live Postgres, while
 * production wires the `pg`-backed implementations.
 */

import type { ChannelName } from '../channels/types.js';

/** Lifecycle of a single per-channel notification row. */
export type NotificationStatus = 'PENDING' | 'DELIVERED' | 'FAILED' | 'DEAD_LETTER';

export interface NotificationRecord {
  id: string;
  userId: string;
  type: string;
  channel: ChannelName;
  lang: string;
  payload: Record<string, unknown>;
  status: NotificationStatus;
  attempts: number;
  createdAt: number;
}

export interface NewNotification {
  userId: string;
  type: string;
  channel: ChannelName;
  lang: string;
  payload: Record<string, unknown>;
  status: NotificationStatus;
}

export interface DeadLetterRecord {
  id: string;
  eventId: string;
  userId: string;
  type: string;
  channel: ChannelName;
  payload: Record<string, unknown>;
  reason: string;
  createdAt: number;
}

export interface NotificationRepository {
  create(notification: NewNotification): Promise<NotificationRecord>;
  /** Update status and overwrite the attempt count for a notification row. */
  updateDelivery(id: string, status: NotificationStatus, attempts: number): Promise<void>;
  findById(id: string): Promise<NotificationRecord | null>;
  listForUser(userId: string): Promise<NotificationRecord[]>;
}

/**
 * Event dedup store keyed by event id (design: Internal Eventing → "notification dedup by event
 * id"). `markProcessed` returns true when the event id was newly recorded, false when it had
 * already been processed (so the consumer can skip duplicates idempotently).
 */
export interface DedupRepository {
  markProcessed(eventId: string, processedAt: number): Promise<boolean>;
  hasProcessed(eventId: string): Promise<boolean>;
}

/** Captures messages that exhausted their retries for operator visibility / redelivery. */
export interface DeadLetterRepository {
  record(
    entry: Omit<DeadLetterRecord, 'id' | 'createdAt'>,
    createdAt: number,
  ): Promise<DeadLetterRecord>;
  list(): Promise<DeadLetterRecord[]>;
}

export interface Repositories {
  notifications: NotificationRepository;
  dedup: DedupRepository;
  deadLetters: DeadLetterRepository;
}
