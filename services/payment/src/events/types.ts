/**
 * Event payloads emitted by the Payment Gateway to the Redis Streams bus (Req 11.5).
 *
 * Two kinds of events flow on payment success:
 *  - a payment-confirmation notification to the retailer, and
 *  - a new-order notification to each affected supplier.
 *
 * Both are delivered on the `notifications` stream consumed by the Notification Service
 * (design: Internal Eventing).
 */

/** Stream name for user-facing notifications. */
export const NOTIFICATIONS_STREAM = 'notifications';

/** Notification event shape (matches the Internal Eventing contract). */
export interface NotificationEvent {
  /** Stable event id used by the consumer for dedup. */
  eventId: string;
  userId: string;
  type: 'PAYMENT_CONFIRMED' | 'NEW_ORDER';
  /** Renderer language hint; the Notification Service resolves the user's language (Req 14.4). */
  lang?: string;
  data: Record<string, unknown>;
  correlationId: string;
}
