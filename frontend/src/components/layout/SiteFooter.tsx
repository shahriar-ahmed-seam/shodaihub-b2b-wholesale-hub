'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Logo } from '@/components/brand/Logo';

export function SiteFooter() {
  const t = useTranslations('nav');
  const tBrand = useTranslations('brand');
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-line bg-surface">
      <div className="container-page flex flex-col gap-6 py-12 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-3 text-sm text-brand-ink-muted">{tBrand('tagline')}</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
          <Link href="/search" className="text-brand-ink-muted hover:text-brand-ink">
            {t('search')}
          </Link>
          <Link href="/auth/register" className="text-brand-ink-muted hover:text-brand-ink">
            {t('register')}
          </Link>
          <Link href="/auth/login" className="text-brand-ink-muted hover:text-brand-ink">
            {t('login')}
          </Link>
          <Link href="/cart" className="text-brand-ink-muted hover:text-brand-ink">
            {t('cart')}
          </Link>
        </nav>
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-wrap items-center justify-between gap-2 py-4 text-xs text-brand-ink-muted">
          <span>© {year} ShodaiHub. Built for Bangladesh wholesale commerce.</span>
          <span>
            Photography via{' '}
            <a
              href="https://unsplash.com?utm_source=b2b_wholesale_hub&utm_medium=referral"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-brand-ink"
            >
              Unsplash
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
