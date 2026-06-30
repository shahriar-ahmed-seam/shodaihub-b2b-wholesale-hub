'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/Button';

/** Prominent landing search bar (Req 8.1). Routes the query into the `/search` results page. */
export function HomeSearch() {
  const t = useTranslations('home');
  const router = useRouter();
  const [query, setQuery] = useState('');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/search?query=${encodeURIComponent(trimmed)}` : '/search');
  };

  return (
    <form onSubmit={onSubmit} role="search" className="flex w-full max-w-xl gap-2">
      <div className="relative flex-1">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchCta')}
          className="h-12 w-full rounded-md border border-line bg-surface pl-11 pr-4 text-sm text-brand-ink shadow-sm placeholder:text-brand-ink-muted/60 focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/25"
        />
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          aria-hidden="true"
          className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-ink-muted"
        >
          <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12.5 12.5L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <Button type="submit" size="lg">
        {t('searchCta')}
      </Button>
    </form>
  );
}
