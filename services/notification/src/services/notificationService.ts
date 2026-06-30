/**
 * Notification Service core orchestration (design: Components → Notification; Error Handling →
 * Notification retries).
 *
 * Responsibilities:
 *  - dedup incoming events by event id so at-least-once stream delivery is idempotent
 *    (design: Internal Eventing);
 *  - render localized content in the user's selected language with English fallback (Req 14.4);
 *  - deliver in-app (always) + email/SMS when enabled (Req 14.1, 14.2);
 *  - retry failed deliveries with backoff, recording a failure / dead-lettering only once the
 *    retries are exhausted (Req 14.3).
 *
 * All collaborators (repositories, channels, clock, sleep) are injected so the logic is unit- and
 * property-testable without a live Postgres or Redis.
 */

import type { Logger } from '@b2b/shared-node';
import type { Channel, DeliveryRequest } from '../channels/types.js';
import type { BackoffPolicy } from '../domain/backoff.js';
import { deliverWithRetry, realSleep, type Sleep } from '../domain/delivery.js';
import { normalizeLanguage, renderNotification } from '../domain/i18n.js';
import type { NotificationStatus, Repositories } from '../repositories/types.js';
import type { Clock } from './clock.js';
import { systemClock } from './clock.js';

/** Inbound event payload consumed from the `notifications` Redis Stream (design: Internal Eventing). */
export interface NotificationEvent {
  /** Stable event id used for dedup; the consumer falls back to the stream message id when absent. */
  eventId: string;
  userId: string;
  type: string;
  /** User's selected language (en|bn); defaults to English when missing/unknown. */
  lang?: string;
  /** Type-specific template data (e.g. orderId, amount, businessName). */
  data?: Record<string, unknown>;
  correlationId?: string;
}

/** Per-channel delivery summary returned by {@link NotificationService.handleEvent}. */
export interface ChannelDeliveryResult {
  notificationId: string;
  channel: string;
  delivered: boolean;
  attempts: number;
  failureRecorded: boolean;
  deadLettered: boolean;
}

/** Result of handling one event. `deduped` is true when the event id was already processed. */
export interface HandleResult {
  deduped: boolean;
  results: ChannelDeliveryResult[];
}

export interface NotificationServiceDeps {
  repositories: Repositories;
  /** Ordered channels to attempt. In-app first; email/SMS appended when enabled. */
  channels: Channel[];
  backoff: BackoffPolicy;
  clock?: Clock;
  /** Wait between retry attempts (injected as a no-op in tests). */
  sleep?: Sleep;
  logger?: Logger;
}

export class NotificationService {
  private readonly repos: Repositories;
  private readonly channels: Channel[];
  private readonly backoff: BackoffPolicy;
  private readonly clock: Clock;
  private readonly sleep: Sleep;
  private readonly logger?: Logger;

  constructor(deps: NotificationServiceDeps) {
    this.repos = deps.repositories;
    this.channels = deps.channels;
    this.backoff = deps.backoff;
    this.clock = deps.clock ?? systemClock;
    this.sleep = deps.sleep ?? realSleep;
    this.logger = deps.logger;
  }

  /**
   * Handle a single notification event end-to-end. Idempotent: a repeated event id is skipped.
   */
  async handleEvent(event: NotificationEvent): Promise<HandleResult> {
    const eventId = event.eventId;

    // Dedup by event id (design: Internal Eventing). markProcessed returns false if already seen.
    const fresh = await this.repos.dedup.markProcessed(eventId, this.clock.now());
    if (!fresh) {
      this.logger?.info('duplicate notification event skipped', { eventId, type: event.type });
      return { deduped: true, results: [] };
    }

    const lang = normalizeLanguage(event.lang);
    const data = event.data ?? {};
    const message = renderNotification(event.type, lang, data);

    const results: ChannelDeliveryResult[] = [];

    for (const channel of this.channels) {
      // Durable per-channel record (in-app delivery == this persistence) — Req 14.1.
      const record = await this.repos.notifications.create({
        userId: event.userId,
        type: event.type,
        channel: channel.name,
        lang,
        payload: data,
        status: 'PENDING',
      });

      const request: DeliveryRequest = {
        notificationId: record.id,
        userId: event.userId,
        type: event.type,
        lang,
        message,
        data,
      };

      const outcome = await deliverWithRetry(() => channel.send(request), this.backoff, this.sleep);

      const status: NotificationStatus = outcome.delivered ? 'DELIVERED' : 'FAILED';
      await this.repos.notifications.updateDelivery(record.id, status, outcome.attempts);

      if (!outcome.delivered) {
        // Dead-letter on repeated failure (Req 14.3) for operator visibility / redelivery.
        await this.repos.deadLetters.record(
          {
            eventId,
            userId: event.userId,
            type: event.type,
            channel: channel.name,
            payload: data,
            reason: `delivery failed after ${outcome.attempts} attempt(s): ${String(
              outcome.lastError ?? 'unknown error',
            )}`,
          },
          this.clock.now(),
        );
        this.logger?.warn('notification delivery failed after retries', {
          eventId,
          channel: channel.name,
          attempts: outcome.attempts,
        });
      }

      results.push({
        notificationId: record.id,
        channel: channel.name,
        delivered: outcome.delivered,
        attempts: outcome.attempts,
        failureRecorded: outcome.failureRecorded,
        deadLettered: outcome.deadLettered,
      });
    }

    return { deduped: false, results };
  }
}
