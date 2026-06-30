/**
 * node-redis implementation of {@link StreamClient} (design: Async messaging → Redis Streams).
 *
 * Wraps the node-redis v4 client so the {@link StreamConsumer} stays decoupled from the driver and
 * testable with fakes. Kept out of the unit test path (it needs a live Redis, only available via
 * Docker) — the consumer orchestration is tested against an in-memory fake instead.
 */

import { createClient, type RedisClientType } from 'redis';
import type { StreamClient, StreamMessage } from './consumer.js';

export class RedisStreamClient implements StreamClient {
  private constructor(private readonly client: RedisClientType) {}

  static async connect(url: string): Promise<RedisStreamClient> {
    const client: RedisClientType = createClient({ url });
    client.on('error', () => {
      /* errors surface on the awaited command; avoid crashing on transient events */
    });
    await client.connect();
    return new RedisStreamClient(client);
  }

  async ensureGroup(stream: string, group: string): Promise<void> {
    try {
      await this.client.xGroupCreate(stream, group, '$', { MKSTREAM: true });
    } catch (err) {
      // BUSYGROUP — the group already exists; any other error is rethrown.
      if (!String(err).includes('BUSYGROUP')) throw err;
    }
  }

  async readGroup(
    stream: string,
    group: string,
    consumer: string,
    options: { count: number; blockMs: number },
  ): Promise<StreamMessage[]> {
    const reply = await this.client.xReadGroup(group, consumer, [{ key: stream, id: '>' }], {
      COUNT: options.count,
      BLOCK: options.blockMs,
    });
    if (!reply) return [];

    const out: StreamMessage[] = [];
    for (const streamReply of reply) {
      for (const entry of streamReply.messages) {
        out.push({ id: entry.id, message: entry.message as Record<string, string> });
      }
    }
    return out;
  }

  async ack(stream: string, group: string, id: string): Promise<void> {
    await this.client.xAck(stream, group, id);
  }

  async ping(): Promise<boolean> {
    try {
      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}
