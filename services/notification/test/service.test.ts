/**
 * Task 9.1 + 9.2 — unit tests for NotificationService: dedup, in-app persistence, language
 * rendering, multi-channel delivery, and failure recording / dead-lettering (Req 14.1–14.4).
 */

import { describe, expect, it } from 'vitest';
import { makeEvent, makeHarness, ScriptedChannel } from './helpers.js';

describe('NotificationService', () => {
  it('persists an in-app notification as DELIVERED on success (Req 14.1)', async () => {
    const h = makeHarness({ channels: [new ScriptedChannel(0, 'IN_APP')] });
    const res = await h.service.handleEvent(makeEvent({ userId: 'u-1' }));

    expect(res.deduped).toBe(false);
    expect(res.results).toHaveLength(1);
    expect(res.results[0]).toMatchObject({ channel: 'IN_APP', delivered: true, attempts: 1 });

    const rows = await h.repos.notifications.listForUser('u-1');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'DELIVERED', channel: 'IN_APP', attempts: 1 });
  });

  it('dedups repeated event ids (Req: Internal Eventing idempotency)', async () => {
    const h = makeHarness();
    const event = makeEvent({ eventId: 'dup-1' });

    const first = await h.service.handleEvent(event);
    const second = await h.service.handleEvent(event);

    expect(first.deduped).toBe(false);
    expect(second.deduped).toBe(true);
    expect(second.results).toHaveLength(0);
    // Only one delivery row was created despite two events.
    expect(await h.repos.notifications.listAll()).toHaveLength(1);
  });

  it('delivers across all enabled channels (Req 14.1, 14.2)', async () => {
    const h = makeHarness({
      channels: [
        new ScriptedChannel(0, 'IN_APP'),
        new ScriptedChannel(0, 'EMAIL'),
        new ScriptedChannel(0, 'SMS'),
      ],
    });
    const res = await h.service.handleEvent(makeEvent());
    expect(res.results.map((r) => r.channel)).toEqual(['IN_APP', 'EMAIL', 'SMS']);
    expect(res.results.every((r) => r.delivered)).toBe(true);
  });

  it('persists the user language used for rendering (Req 14.4)', async () => {
    const h = makeHarness();
    await h.service.handleEvent(makeEvent({ userId: 'bn-user', lang: 'bn' }));
    const rows = await h.repos.notifications.listForUser('bn-user');
    expect(rows[0]?.lang).toBe('bn');
  });

  it('records a failure and dead-letters after retries are exhausted (Req 14.3)', async () => {
    const h = makeHarness({
      channels: [new ScriptedChannel(Number.POSITIVE_INFINITY, 'EMAIL')],
      backoff: { maxRetries: 3, baseDelayMs: 1, factor: 2 },
    });
    const res = await h.service.handleEvent(makeEvent({ userId: 'u-fail' }));

    expect(res.results[0]).toMatchObject({
      channel: 'EMAIL',
      delivered: false,
      attempts: 4,
      failureRecorded: true,
      deadLettered: true,
    });

    const rows = await h.repos.notifications.listForUser('u-fail');
    expect(rows[0]).toMatchObject({ status: 'FAILED', attempts: 4 });

    const dead = await h.repos.deadLetters.list();
    expect(dead).toHaveLength(1);
    expect(dead[0]).toMatchObject({ userId: 'u-fail', channel: 'EMAIL' });
  });
});
