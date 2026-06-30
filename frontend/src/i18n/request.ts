import { getRequestConfig } from 'next-intl/server';
import { routing, type Locale } from './routing';
import { mergeWithFallback, type MessageTree } from './fallback';
import enMessages from '../../messages/en.json';
import bnMessages from '../../messages/bn.json';

const CATALOGS: Record<Locale, MessageTree> = {
  en: enMessages as MessageTree,
  bn: bnMessages as MessageTree,
};

/**
 * Per-request i18n config (Req 17.1, 17.4). Non-English catalogs are deep-merged over the English
 * base so any key missing in the selected locale falls back to English — the same rule covered by
 * Property 41's translation-fallback resolver.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale: Locale = routing.locales.includes(requested as Locale)
    ? (requested as Locale)
    : routing.defaultLocale;

  const messages =
    locale === 'en' ? CATALOGS.en : mergeWithFallback(CATALOGS.en, CATALOGS[locale]);

  return { locale, messages };
});
