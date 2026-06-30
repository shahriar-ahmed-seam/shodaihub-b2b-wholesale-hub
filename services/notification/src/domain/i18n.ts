/**
 * Notification content rendering with a small message catalog and English fallback
 * (Req 14.4, 17.4).
 *
 * Pure and dependency-free: given a notification `type`, a `lang`, and a data bag, it produces the
 * localized `{ subject, body }`. When a key is missing in the selected language, the English text
 * is used as the fallback so a user always receives readable content.
 */

/** Supported interface languages (design: Data Models → preferred_language). */
export type Language = 'en' | 'bn';

export const SUPPORTED_LANGUAGES: readonly Language[] = ['en', 'bn'];
export const FALLBACK_LANGUAGE: Language = 'en';

/** A single rendered notification message. */
export interface RenderedMessage {
  subject: string;
  body: string;
}

/** A catalog template carries a subject + body with `{placeholder}` slots. */
interface MessageTemplate {
  subject: string;
  body: string;
}

type CatalogEntry = Partial<Record<Language, MessageTemplate>>;

/**
 * Notification event types the platform emits (design: Internal Eventing; Req 3.3, 11.5, 12.6).
 * The catalog intentionally leaves some Bangla strings unset to exercise the English fallback.
 */
export const NotificationType = {
  KYC_APPROVED: 'KYC_APPROVED',
  KYC_REJECTED: 'KYC_REJECTED',
  PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
  NEW_ORDER: 'NEW_ORDER',
  ORDER_STATUS_CHANGED: 'ORDER_STATUS_CHANGED',
} as const;

export type NotificationTypeValue = (typeof NotificationType)[keyof typeof NotificationType];

/**
 * Message catalog. English is always present (it is the fallback language); Bangla is present for
 * a subset of types to demonstrate per-key fallback (Req 17.4).
 */
const CATALOG: Record<string, CatalogEntry> = {
  [NotificationType.KYC_APPROVED]: {
    en: {
      subject: 'Your business is verified',
      body: 'Congratulations {businessName}, your KYC is approved. You can now publish products.',
    },
    bn: {
      subject: 'আপনার ব্যবসা যাচাই করা হয়েছে',
      body: 'অভিনন্দন {businessName}, আপনার কেওয়াইসি অনুমোদিত হয়েছে। আপনি এখন পণ্য প্রকাশ করতে পারেন।',
    },
  },
  [NotificationType.KYC_REJECTED]: {
    en: {
      subject: 'KYC submission rejected',
      body: 'Your KYC was rejected. Reason: {reason}',
    },
    // Bangla intentionally omitted → falls back to English (Req 17.4).
  },
  [NotificationType.PAYMENT_CONFIRMED]: {
    en: {
      subject: 'Payment confirmed',
      body: 'We received your payment of BDT {amount} for order {orderId}.',
    },
    bn: {
      subject: 'পেমেন্ট নিশ্চিত হয়েছে',
      body: 'অর্ডার {orderId}-এর জন্য আপনার BDT {amount} পেমেন্ট গ্রহণ করা হয়েছে।',
    },
  },
  [NotificationType.NEW_ORDER]: {
    en: {
      subject: 'New order received',
      body: 'You have a new order {orderId} from a retailer.',
    },
    // Bangla intentionally omitted → falls back to English (Req 17.4).
  },
  [NotificationType.ORDER_STATUS_CHANGED]: {
    en: {
      subject: 'Order status updated',
      body: 'Order {orderId} is now {status}.',
    },
    bn: {
      subject: 'অর্ডারের অবস্থা পরিবর্তিত হয়েছে',
      body: 'অর্ডার {orderId} এখন {status}।',
    },
  },
};

/** Normalize an arbitrary input into a supported language, defaulting to the fallback. */
export function normalizeLanguage(lang: unknown): Language {
  return lang === 'bn' ? 'bn' : 'en';
}

/** Substitute `{key}` placeholders with values from `data` (missing keys render as empty). */
function interpolate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = data[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

/**
 * Render a notification's localized content.
 *
 * Resolution order (Req 14.4, 17.4):
 *   1. template for the requested language;
 *   2. otherwise the English fallback template;
 *   3. otherwise a generic message built from the type (never throws).
 */
export function renderNotification(
  type: string,
  lang: unknown,
  data: Record<string, unknown> = {},
): RenderedMessage {
  const language = normalizeLanguage(lang);
  const entry = CATALOG[type];

  const template = entry?.[language] ?? entry?.[FALLBACK_LANGUAGE];
  if (!template) {
    // Unknown type: degrade gracefully rather than failing delivery.
    return { subject: type, body: type };
  }

  return {
    subject: interpolate(template.subject, data),
    body: interpolate(template.body, data),
  };
}

/** True when the catalog has a template for `type` in `lang` (no fallback applied). */
export function hasTranslation(type: string, lang: Language): boolean {
  return Boolean(CATALOG[type]?.[lang]);
}
