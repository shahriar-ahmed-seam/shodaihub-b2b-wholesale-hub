/**
 * Task 9.1 — unit tests for localized rendering + English fallback (Req 14.4, 17.4).
 */

import { describe, expect, it } from 'vitest';
import {
  hasTranslation,
  NotificationType,
  normalizeLanguage,
  renderNotification,
} from '../src/domain/i18n.js';

describe('notification i18n', () => {
  it('renders in the requested language when available', () => {
    const msg = renderNotification(NotificationType.PAYMENT_CONFIRMED, 'bn', {
      orderId: 'o-9',
      amount: '250.00',
    });
    expect(msg.subject).toBe('পেমেন্ট নিশ্চিত হয়েছে');
    expect(msg.body).toContain('o-9');
    expect(msg.body).toContain('250.00');
  });

  it('falls back to English when the language is missing for the key (Req 17.4)', () => {
    // NEW_ORDER has no Bangla template → English fallback.
    expect(hasTranslation(NotificationType.NEW_ORDER, 'bn')).toBe(false);
    const msg = renderNotification(NotificationType.NEW_ORDER, 'bn', { orderId: 'o-1' });
    expect(msg.subject).toBe('New order received');
    expect(msg.body).toContain('o-1');
  });

  it('interpolates placeholders and leaves missing data empty', () => {
    const msg = renderNotification(NotificationType.KYC_REJECTED, 'en', {});
    expect(msg.body).toBe('Your KYC was rejected. Reason: ');
  });

  it('normalizes unknown languages to English', () => {
    expect(normalizeLanguage('fr')).toBe('en');
    expect(normalizeLanguage(undefined)).toBe('en');
    expect(normalizeLanguage('bn')).toBe('bn');
  });

  it('degrades gracefully for unknown types', () => {
    const msg = renderNotification('SOMETHING_NEW', 'en', {});
    expect(msg.subject).toBe('SOMETHING_NEW');
  });
});
