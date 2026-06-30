import { Inter, Noto_Sans_Bengali, Sora } from 'next/font/google';

/**
 * Brand typefaces (design tokens): Sora for display headings, Inter for body, Noto Sans Bengali
 * for the `bn` locale. Exposed as CSS variables consumed by the Tailwind font families.
 * BRAND ASSET SLOT: to use licensed brand fonts, swap these for `next/font/local` definitions —
 * the variable names (`--font-display`, `--font-body`, `--font-bengali`) stay the same so no
 * component changes are needed.
 */
export const displayFont = Sora({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

export const bodyFont = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
});

export const bengaliFont = Noto_Sans_Bengali({
  subsets: ['bengali'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-bengali',
  display: 'swap',
});
