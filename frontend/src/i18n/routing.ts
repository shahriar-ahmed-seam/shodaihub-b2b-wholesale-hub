import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

/**
 * Locale routing for the platform (Req 17.1, 17.2). English is the default and the
 * missing-translation fallback source (Req 17.4). `localePrefix: 'always'` keeps the
 * active locale visible in the URL (`/en/...`, `/bn/...`).
 */
export const routing = defineRouting({
  locales: ['en', 'bn'],
  defaultLocale: 'en',
  localePrefix: 'always',
});

export type Locale = (typeof routing.locales)[number];

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
