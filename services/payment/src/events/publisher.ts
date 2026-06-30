/**
 * Redis Streams event publisher (Req 11.5).
 *
 * The service depends only on {@link EventPublisher} so emission can be faked in tests
 * ({@link InMemoryEventPublisher}). Production uses {@link RedisStreamPublisher}, a dependency-free
 * `XADD` publisher implemented directly over the Redis RESP protocol with the Node `net` socket
 * API, so no external Redis client library is required.
 */

import { connect, type Socket } from 'node:net';
import type { Logger } from '@b2b/shared-node';
import type { NotificationEvent } from './types.js';

export interface EventPublisher {
  /** Append an event to the given stream. Best-effort; must not throw on transport failure. */
  publish(stream: string, event: NotificationEvent): Promise<void>;
}

/** Test/double publisher: records every published event in order. */
export class InMemoryEventPublisher implements EventPublisher {
  readonly events: Array<{ stream: string; event: NotificationEvent }> = [];

  async publish(stream: string, event: NotificationEvent): Promise<void> {
    this.events.push({ stream, event });
  }

  /** Convenience accessor: all events emitted to a given stream. */
  forStream(stream: string): NotificationEvent[] {
    return this.events.filter((e) => e.stream === stream).map((e) => e.event);
  }
}

/** No-op publisher that logs intent — a safe fallback when Redis is not configured. */
export class LoggingEventPublisher implements EventPublisher {
  constructor(private readonly logger: Logger) {}

  async publish(stream: string, event: NotificationEvent): Promise<void> {
    this.logger.info('Event published (logging publisher)', { stream, type: event.type });
  }
}

/**
 * Encode a Redis command as a RESP array of bulk strings.
 *
 * Pure function — exported for unit testing. Example: `["XADD","s","*","k","v"]` →
 * `*5\r\n$4\r\nXADD\r\n...`.
 */
export function encodeResp(args: string[]): Buffer {
  let out = `*${args.length}\r\n`;
  for (const arg of args) {
    const buf = Buffer.byteLength(arg);
    out += `$${buf}\r\n${arg}\r\n`;
  }
  return Buffer.from(out, 'utf8');
}

/** Parse `redis://host:port` (and `rediss://`) into host/port. */
export function parseRedisUrl(url: string): { host: string; port: number } {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || 'localhost',
      port: parsed.port ? Number.parseInt(parsed.port, 10) : 6379,
    };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}

export interface RedisStreamPublisherOptions {
  url: string;
  logger: Logger;
  connectTimeoutMs?: number;
}

/**
 * Minimal `XADD`-only Redis Streams publisher over RESP.
 *
 * Each publish opens a short-lived connection, issues `XADD <stream> * field value ...`, and
 * resolves once the server acknowledges. Transport failures are logged and swallowed so a Redis
 * outage never breaks the payment-confirmation path (the consumer also reconciles independently).
 */
export class RedisStreamPublisher implements EventPublisher {
  private readonly host: string;
  private readonly port: number;
  private readonly logger: Logger;
  private readonly connectTimeoutMs: number;

  constructor(options: RedisStreamPublisherOptions) {
    const { host, port } = parseRedisUrl(options.url);
    this.host = host;
    this.port = port;
    this.logger = options.logger;
    this.connectTimeoutMs = options.connectTimeoutMs ?? 2000;
  }

  async publish(stream: string, event: NotificationEvent): Promise<void> {
    const args = [
      'XADD',
      stream,
      '*',
      'eventId',
      event.eventId,
      'userId',
      event.userId,
      'type',
      event.type,
      'lang',
      event.lang ?? '',
      'data',
      JSON.stringify(event.data),
      'correlationId',
      event.correlationId,
    ];
    try {
      await this.send(encodeResp(args));
    } catch (err) {
      this.logger.error('Failed to publish event to Redis Streams', {
        stream,
        type: event.type,
        error: String(err),
      });
    }
  }

  private send(payload: Buffer): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const socket: Socket = connect({ host: this.host, port: this.port });
      const done = (err?: Error): void => {
        if (settled) return;
        settled = true;
        socket.destroy();
        if (err) reject(err);
        else resolve();
      };
      socket.setTimeout(this.connectTimeoutMs, () => done(new Error('redis connect timeout')));
      socket.once('error', (err) => done(err));
      socket.once('connect', () => {
        socket.write(payload);
      });
      // Resolve on the first reply chunk (XADD returns the new entry id).
      socket.once('data', () => done());
    });
  }
}
