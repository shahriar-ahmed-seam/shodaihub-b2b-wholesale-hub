'use client';

import { useTranslations } from 'next-intl';
import type { PaymentProvider } from '@/lib/api/types';
import { cn } from '@/lib/cn';

interface ProviderMeta {
  id: PaymentProvider;
  label: string;
  swatch: string;
}

const PROVIDERS: ProviderMeta[] = [
  { id: 'bkash', label: 'bKash', swatch: '#E2136E' },
  { id: 'nagad', label: 'Nagad', swatch: '#EE7421' },
  { id: 'sslcommerz', label: 'SSLCommerz', swatch: '#1C8C44' },
];

/**
 * Single-select payment provider picker (Req 11.1: exactly one provider per transaction). Renders
 * an accessible radiogroup with brand-coloured swatches; the parent owns the selected value.
 */
export function PaymentProviderPicker({
  value,
  onChange,
}: {
  value: PaymentProvider | null;
  onChange: (provider: PaymentProvider) => void;
}) {
  const t = useTranslations('checkout');

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-brand-ink">{t('provider')}</legend>
      <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
        {PROVIDERS.map((provider) => {
          const selected = value === provider.id;
          return (
            <button
              key={provider.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(provider.id)}
              className={cn(
                'flex items-center gap-3 rounded-md border-2 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40',
                selected
                  ? 'border-brand-primary bg-brand-primary-100'
                  : 'border-line bg-surface hover:border-brand-primary-300',
              )}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
                style={{ backgroundColor: provider.swatch }}
                aria-hidden="true"
              >
                {provider.label.slice(0, 2)}
              </span>
              <span className="text-sm font-medium text-brand-ink">{provider.label}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-brand-ink-muted">{t('providerHint')}</p>
    </fieldset>
  );
}
