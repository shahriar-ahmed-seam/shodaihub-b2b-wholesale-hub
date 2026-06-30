'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { usePathname, useRouter } from '@/i18n/routing';
import type { Locale } from '@/i18n/routing';
import { cn } from '@/lib/cn';

/**
 * Toggles the active locale (Req 17.1, 17.2). Switching re-routes to the same path under the new
 * locale prefix; next-intl re-renders all interface text in the chosen language.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations('language');
  const locale = useLocale();
  const router = useRouter();
  // next-intl's usePathname returns the locale-agnostic path with dynamic segments already
  // resolved (e.g. `/products/123`), so re-routing under the new locale preserves the route.
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const switchTo = (next: Locale) => {
    if (next === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  };

  const locales: Locale[] = ['en', 'bn'];

  return (
    <div
      role="group"
      aria-label={t('label')}
      className={cn('inline-flex items-center rounded-pill border border-line bg-surface p-0.5', className)}
    >
      {locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => switchTo(loc)}
          aria-pressed={locale === loc}
          disabled={isPending}
          className={cn(
            'rounded-pill px-3 py-1 text-xs font-semibold transition-colors',
            locale === loc
              ? 'bg-brand-primary text-white'
              : 'text-brand-ink-muted hover:text-brand-ink',
          )}
        >
          {t(loc)}
        </button>
      ))}
    </div>
  );
}
