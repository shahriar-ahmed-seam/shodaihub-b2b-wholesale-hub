'use client';

import { useLocale } from 'next-intl';
import { formatBDT, type CurrencyLocale } from '@/lib/currency';
import { cn } from '@/lib/cn';

export interface CurrencyAmountProps {
  amount: number;
  className?: string;
  /** Visually emphasise the value (totals). */
  emphasis?: boolean;
}

/**
 * Renders a monetary value in BDT (Req 17.3) using the active locale's numerals via the shared
 * `formatBDT` helper (covered by Property 41). Wrapped in a semantic `<data>` element carrying the
 * machine-readable value.
 */
export function CurrencyAmount({ amount, className, emphasis }: CurrencyAmountProps) {
  const locale = useLocale() as CurrencyLocale;
  return (
    <data
      value={String(amount)}
      className={cn('tabular-nums', emphasis && 'font-semibold text-brand-ink', className)}
    >
      {formatBDT(amount, locale === 'bn' ? 'bn' : 'en')}
    </data>
  );
}
