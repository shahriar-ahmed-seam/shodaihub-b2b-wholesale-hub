/**
 * Task 9.1 — unit tests for the Redis Streams consumer orchestration against a fake stream
 * (no live Redis required). Verifies parsing, dedup-driven idempotency, and XACK on success.
 */

import { describe, expect, it } from 'vitest';
import {
  parseStreamMessage,
  StreamConsumer,
  type StreamClient,
  type StreamMessage,
} from '../src/consumer.js';
import { makeHarness, ScriptedChannel } from './helpers.js';

/** In-memory stream client: hands out queued messages once and records acks. */
class FakeStreamClient implements StreamClient {
  acked: string[] = [];
  groupsEnsured: string[] = [];
  private batches: StreamMessage[][];

  constructor(batches: StreamMessage[][]) {
    this.batches = [...batches];
  }

  async ensureGroup(stream: string, group: string): Promise<void> {
    this.groupsEnsured.push(`${stream}:${group}`);
  }

  async readGroup(): Promise<StreamMessage[]> {
    return this.batches.shift() ?? [];
  }

  async ack(_stream: string, _group: string, id: string): Promise<void> {
    this.acked.push(id);
  }
}

describe('stream consumer', () => {
  it('parses a flat stream message into an event (id is the dedup fallback)', () => {
    const event = parseStreamMessage({
      id: '1700000000000-0',
      message: { userId: 'u-1', type: 'NEW_ORDER', lang: 'bn', data: '{"orderId":"o-42"}' },
    });
    expect(event).toMatchObject({
      eventId: '1700000000000-0',
      userId: 'u-1',
      type: 'NEW_ORDER',
      lang: 'bn',
    });
    expect(event.data).toEqual({ orderId: 'o-42' });
  });

  it('processes a batch and ACKs each successfully handled message', async () => {
    const h = makeHarness({ channels: [new ScriptedChannel(0, 'IN_APP')] });
    const client = new FakeStreamClient([
      [
        {
          id: '1-0',
          message: { eventId: 'e1', userId: 'u-1', type: 'PAYMENT_CONFIRMED', data: '{}' },
        },
        { id: '2-0', message: { eventId: 'e2', userId: 'u-2', type: 'NEW_ORDER', data: '{}' } },
      ],
    ]);
    const consumer = new StreamConsumer(client, h.service, {
      stream: 'notifications',
      group: 'g',
      consumer: 'c',
    });

    const count = await consumer.processBatch();
    expect(count).toBe(2);
    expect(client.acked).toEqual(['1-0', '2-0']);
    expect(await h.repos.notifications.listAll()).toHaveLength(2);
  });

  it('redelivery of the same event id is idempotent (dedup)', async () => {
    const h = makeHarness({ channels: [new ScriptedChannel(0, 'IN_APP')] });
    const msg: StreamMessage = {
      id: '1-0',
      message: { eventId: 'same', userId: 'u-1', type: 'PAYMENT_CONFIRMED', data: '{}' },
    };
    const client = new FakeStreamClient([[msg], [msg]]);
    const consumer = new StreamConsumer(client, h.service, {
      stream: 'notifications',
      group: 'g',
      consumer: 'c',
    });

    await consumer.processBatch();
    await consumer.processBatch();

    // Acked both times (the consumer always acks handled messages), but only one row persisted.
    expect(client.acked).toEqual(['1-0', '1-0']);
    expect(await h.repos.notifications.listAll()).toHaveLength(1);
  });
});
