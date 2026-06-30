'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import type { Role, SessionUser } from '@/lib/api/types';
import { cn } from '@/lib/cn';

const CartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path
      d="M2 2h2l1.5 10.5A2 2 0 007.48 14H15a2 2 0 001.97-1.64L18 6H5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="8" cy="17" r="1.4" fill="currentColor" />
    <circle cx="15" cy="17" r="1.4" fill="currentColor" />
  </svg>
);

/** Role → home destination for the authenticated user's primary workspace. */
const roleHome: Record<Role, string> = {
  SUPPLIER: '/supplier/dashboard',
  RETAILER: '/orders',
  ADMINISTRATOR: '/admin',
};

export function SiteHeader({ user }: { user: SessionUser | null }) {
  const t = useTranslations('nav');
  const tHome = useTranslations('home');
  const router = useRouter();
  const [query, setQuery] = useState('');

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/search?query=${encodeURIComponent(trimmed)}` : '/search');
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  };

  const searchField = (
    <>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={tHome('searchPlaceholder')}
        aria-label={t('search')}
        className="h-10 w-full rounded-pill border border-line bg-surface-muted pl-10 pr-4 text-sm text-brand-ink placeholder:text-brand-ink-muted/60 focus-visible:border-brand-primary focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/25"
      />
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        aria-hidden="true"
        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-ink-muted"
      >
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12.5 12.5L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
      <div className="container-page flex h-16 items-center gap-2 sm:gap-4">
        <Link href="/" className="shrink-0" aria-label="ShodaiHub home">
          <Logo className="h-6 w-auto sm:h-7" />
        </Link>

        {/* Desktop inline search — collapses to a dedicated mobile row below md. */}
        <form onSubmit={onSearch} role="search" className="relative hidden flex-1 md:block">
          {searchField}
        </form>

        <nav className="ml-auto flex items-center gap-1.5 sm:gap-2" aria-label="Primary">
          {/* On mobile the switcher lives in the search row below; show it inline from md up. */}
          <LanguageSwitcher className="hidden md:inline-flex" />

          {user?.role === 'RETAILER' || !user ? (
            <Link
              href="/cart"
              className={cn(
                'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-brand-ink hover:bg-surface-muted',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40',
              )}
              aria-label={t('cart')}
            >
              <CartIcon />
            </Link>
          ) : null}

          {user ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href={roleHome[user.role]}>{t('dashboard')}</Link>
              </Button>
              <Button variant="outline" size="sm" onClick={logout}>
                {t('logout')}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link href="/auth/login">{t('login')}</Link>
              </Button>
              <Button asChild variant="primary" size="sm">
                <Link href="/auth/register">{t('register')}</Link>
              </Button>
            </div>
          )}
        </nav>
      </div>

      {/* Mobile search row (Req: search reachable + language switcher reachable below md). */}
      <div className="container-page flex items-center gap-2 pb-3 md:hidden">
        <form onSubmit={onSearch} role="search" className="relative flex-1">
          {searchField}
        </form>
        <LanguageSwitcher className="shrink-0" />
      </div>
    </header>
  );
}
