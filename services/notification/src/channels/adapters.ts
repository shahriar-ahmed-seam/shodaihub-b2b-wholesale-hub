/**
 * Concrete delivery-channel adapters (Req 14.1, 14.2).
 *
 * - {@link InAppChannel} — persists the in-app notification (delivery == persistence) via a
 *   callback so it stays decoupled from the repository module.
 * - {@link ConsoleEmailChannel} / {@link ConsoleSmsChannel} — mock adapters that log the message;
 *   they stand in for real providers (toggled by EMAIL_ENABLED / SMS_ENABLED) and can be swapped
 *   without changing the service.
 */

import type { Logger } from '@b2b/shared-node';
import type { Channel, ChannelName, DeliveryRequest } from './types.js';

/**
 * In-app channel: in-app delivery *is* persistence. The service durably writes the notification
 * row before invoking the channel, so the message is already available to the user in-app; this
 * send therefore succeeds. An optional hook lets callers observe delivery (e.g. push/SSE fan-out).
 */
export class InAppChannel implements Channel {
  readonly name: ChannelName = 'IN_APP';

  constructor(private readonly onDeliver?: (request: DeliveryRequest) => Promise<void> | void) {}

  async send(request: DeliveryRequest): Promise<void> {
    await this.onDeliver?.(request);
  }
}

/** Mock email channel that logs instead of calling a provider. */
export class ConsoleEmailChannel implements Channel {
  readonly name: ChannelName = 'EMAIL';

  constructor(private readonly logger?: Logger) {}

  async send(request: DeliveryRequest): Promise<void> {
    this.logger?.info('email delivery (mock)', {
      channel: 'EMAIL',
      userId: request.userId,
      type: request.type,
      subject: request.message.subject,
    });
  }
}

/** Mock SMS channel that logs instead of calling a provider. */
export class ConsoleSmsChannel implements Channel {
  readonly name: ChannelName = 'SMS';

  constructor(private readonly logger?: Logger) {}

  async send(request: DeliveryRequest): Promise<void> {
    this.logger?.info('sms delivery (mock)', {
      channel: 'SMS',
      userId: request.userId,
      type: request.type,
      subject: request.message.subject,
    });
  }
}
