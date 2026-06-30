import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { routing, type Locale } from '@/i18n/routing';
import { bengaliFont, bodyFont, displayFont } from '../fonts';
import { Providers } from '../providers';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { getSessionUser } from '@/lib/api/server';
import '../globals.css';

export const metadata: Metadata = {
  title: {
    default: 'ShodaiHub — Bangladesh B2B Wholesale Marketplace',
    template: '%s · ShodaiHub',
  },
  description:
    'Source from verified suppliers, lock in tiered bulk pricing, and fulfil multi-vendor orders in BDT.',
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  const { locale } = params;
  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  // Enable static rendering for this locale segment.
  setRequestLocale(locale);

  const messages = await getMessages();
  const user = await getSessionUser();

  return (
    <html
      lang={locale}
      className={`${displayFont.variable} ${bodyFont.variable} ${bengaliFont.variable}`}
    >
      <body className="min-h-dvh">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-md focus:bg-brand-primary focus:px-4 focus:py-2 focus:text-white"
            >
              {messages?.nav && typeof messages.nav === 'object'
                ? (messages.nav as Record<string, string>).skipToContent
                : 'Skip to content'}
            </a>
            <div className="flex min-h-dvh flex-col">
              <SiteHeader user={user} />
              <main id="main-content" className="flex-1">
                {children}
              </main>
              <SiteFooter />
            </div>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
