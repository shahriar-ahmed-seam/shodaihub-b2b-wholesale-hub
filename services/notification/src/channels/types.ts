/**
 * Pluggable delivery-channel abstraction (Req 14.1, 14.2).
 *
 * In-app delivery is always available (it persists the notification). Email and SMS are optional
 * channels toggled by `EMAIL_ENABLED` / `SMS_ENABLED`; in local/dev they are mock/console adapters,
 * and real providers can be slotted in behind the same interface without touching the service.
 */

import type { RenderedMessage } from '../domain/i18n.js';

/** The delivery channels the platform understands. */
export type ChannelName = 'IN_APP' | 'EMAIL' | 'SMS';

/** Recipient + rendered content handed to a channel for a single delivery attempt. */
export interface DeliveryRequest {
  notificationId: string;
  userId: string;
  type: string;
  lang: string;
  message: RenderedMessage;
  /** Original event/notification data (e.g. email address, phone), provider-specific. */
  data: Record<string, unknown>;
}

/**
 * A delivery channel. `send` performs exactly one attempt and **throws/rejects on failure** so the
 * retry executor ({@link import('../domain/delivery.js').deliverWithRetry}) can drive backoff.
 */
export interface Channel {
  readonly name: ChannelName;
  send(request: DeliveryRequest): Promise<void>;
}
