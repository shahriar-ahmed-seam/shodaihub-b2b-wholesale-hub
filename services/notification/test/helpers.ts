/**
 * Shared test scaffolding: a controllable delivery channel plus a service harness over in-memory
 * repositories with a no-op sleep, so the suites (including the Property 42 retry suite) run many
 * iterations without a live Postgres, Redis, or real timers.
 */

import type { Channel, ChannelName, DeliveryRequest } from '../src/channels/types.js';
import type { BackoffPolicy } from '../src/domain/backoff.js';
import { createInMemoryRepositories } from '../src/repositories/memory.js';
import { FixedClock } from '../src/services/clock.js';
import { NotificationService } from '../src/services/notificationService.js';

/**
 * A channel whose attempts fail until a configured success attempt. `failUntil = Infinity` fails
 * forever; `failUntil = 0` succeeds on the first attempt. Records the attempt count.
 */
export class ScriptedChannel implements Channel {
  readonly name: ChannelName;
  attempts = 0;
  private readonly failUntil: number;

  /** @param failUntil number of leading attempts that fail (attempt n succeeds when n > failUntil). */
  constructor(failUntil: number, name: ChannelName = 'IN_APP') {
    this.failUntil = failUntil;
    this.name = name;
  }

  async send(_request: DeliveryRequest): Promise<void> {
    this.attempts += 1;
    if (this.attempts <= this.failUntil) {
      throw new Error(`scripted failure on attempt ${this.attempts}`);
    }
  }
}

/** No-op sleep so retry backoff does not actually wait during tests. */
export const noopSleep = async (_ms: number): Promise<void> => undefined;

export interface HarnessOptions {
  channels?: Channel[];
  backoff?: BackoffPolicy;
  startTime?: number;
}

export function makeHarness(options: HarnessOptions = {}) {
  const repos = createInMemoryRepositories();
  const clock = new FixedClock(options.startTime ?? Date.UTC(2025, 0, 1, 0, 0, 0));
  const channels = options.channels ?? [new ScriptedChannel(0)];
  const backoff = options.backoff ?? {
    maxRetries: 3,
    baseDelayMs: 1000,
    factor: 2,
    maxDelayMs: 60_000,
  };
  const service = new NotificationService({
    repositories: repos,
    channels,
    backoff,
    clock,
    sleep: noopSleep,
  });
  return { service, repos, clock, channels, backoff };
}

let eventCounter = 0;
export function makeEvent(
  overrides: Partial<import('../src/services/notificationService.js').NotificationEvent> = {},
) {
  eventCounter += 1;
  return {
    eventId: overrides.eventId ?? `evt-${eventCounter}`,
    userId: overrides.userId ?? 'user-1',
    type: overrides.type ?? 'PAYMENT_CONFIRMED',
    lang: overrides.lang ?? 'en',
    data: overrides.data ?? { orderId: 'o-1', amount: '100.00' },
    correlationId: overrides.correlationId,
  };
}
