/**
 * Redis Streams consumer for the `notifications` stream (design: Internal Eventing).
 *
 * Uses a consumer group (`XREADGROUP`) for at-least-once delivery, then `XACK`s each message after
 * the {@link NotificationService} has processed it. Because the service dedups by event id and the
 * delivery path is idempotent, redelivery of an unacked message is safe.
 *
 * The Redis client is injected behind {@link StreamClient} so this orchestration can be unit-tested
 * with a fake stream and the production wiring uses node-redis.
 */

import type { Logger } from '@b2b/shared-node';
import type { NotificationEvent, NotificationService } from './services/notificationService.js';

/** One stream entry: an id plus its flat field/value message map. */
export interface StreamMessage {
  id: string;
  message: Record<string, string>;
}

/** Minimal Redis Streams surface the consumer depends on (subset of node-redis). */
export interface StreamClient {
  ensureGroup(stream: string, group: string): Promise<void>;
  readGroup(
    stream: string,
    group: string,
    consumer: string,
    options: { count: number; blockMs: number },
  ): Promise<StreamMessage[]>;
  ack(stream: string, group: string, id: string): Promise<void>;
}

export interface ConsumerOptions {
  stream: string;
  group: string;
  consumer: string;
  count?: number;
  blockMs?: number;
}

/** Translate a flat stream message into a {@link NotificationEvent} (id is the dedup fallback). */
export function parseStreamMessage(entry: StreamMessage): NotificationEvent {
  const m = entry.message;
  let data: Record<string, unknown> = {};
  if (typeof m.data === 'string' && m.data.length > 0) {
    try {
      data = JSON.parse(m.data) as Record<string, unknown>;
    } catch {
      data = { raw: m.data };
    }
  }
  return {
    eventId: m.eventId && m.eventId.length > 0 ? m.eventId : entry.id,
    userId: m.userId ?? '',
    type: m.type ?? '',
    lang: m.lang,
    data,
    correlationId: m.correlationId,
  };
}

export class StreamConsumer {
  private running = false;

  constructor(
    private readonly client: StreamClient,
    private readonly service: NotificationService,
    private readonly options: ConsumerOptions,
    private readonly logger?: Logger,
  ) {}

  /** Process a single batch of messages (exposed for tests + the run loop). */
  async processBatch(): Promise<number> {
    const { stream, group, consumer, count = 10, blockMs = 5000 } = this.options;
    const messages = await this.client.readGroup(stream, group, consumer, { count, blockMs });
    for (const entry of messages) {
      const event = parseStreamMessage(entry);
      try {
        await this.service.handleEvent(event);
      } catch (err) {
        // Processing errors are logged; the message stays unacked for redelivery.
        this.logger?.error('failed to process notification event', {
          id: entry.id,
          error: String(err),
        });
        continue;
      }
      await this.client.ack(stream, group, entry.id);
    }
    return messages.length;
  }

  /** Run the blocking consume loop until {@link stop} is called. */
  async run(): Promise<void> {
    const { stream, group } = this.options;
    await this.client.ensureGroup(stream, group);
    this.running = true;
    this.logger?.info('notification consumer started', { stream, group });
    while (this.running) {
      try {
        await this.processBatch();
      } catch (err) {
        this.logger?.error('consumer loop error', { error: String(err) });
        // Brief pause so a persistent error does not spin the CPU.
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  stop(): void {
    this.running = false;
  }
}
