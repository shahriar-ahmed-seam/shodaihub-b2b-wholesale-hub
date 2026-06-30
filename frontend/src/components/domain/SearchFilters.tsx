'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';

const CATEGORY_KEYS = ['grocery', 'textiles', 'electronics', 'household', 'agriculture', 'construction'] as const;

/**
 * Conjunctive search filters (Req 8.3): category, price range, and minimum available quantity.
 * Applying writes the filters to the URL query so results are server-rendered and shareable;
 * min>max price is blocked client-side (mirrors Req 8.9).
 */
export function SearchFilters() {
  const t = useTranslations('search');
  const tcat = useTranslations('categories');
  const router = useRouter();
  const params = useSearchParams();

  const [category, setCategory] = useState(params.get('category') ?? '');
  const [minPrice, setMinPrice] = useState(params.get('minPrice') ?? '');
  const [maxPrice, setMaxPrice] = useState(params.get('maxPrice') ?? '');
  const [minQty, setMinQty] = useState(params.get('minQty') ?? '');
  const [priceError, setPriceError] = useState<string | undefined>();

  const apply = (e: FormEvent) => {
    e.preventDefault();
    if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) {
      setPriceError(t('filterPriceMin'));
      return;
    }
    setPriceError(undefined);
    const sp = new URLSearchParams();
    const existingQuery = params.get('query');
    if (existingQuery) sp.set('query', existingQuery);
    if (category) sp.set('category', category);
    if (minPrice) sp.set('minPrice', minPrice);
    if (maxPrice) sp.set('maxPrice', maxPrice);
    if (minQty) sp.set('minQty', minQty);
    router.push(`/search?${sp.toString()}`);
  };

  const clear = () => {
    setCategory('');
    setMinPrice('');
    setMaxPrice('');
    setMinQty('');
    setPriceError(undefined);
    const existingQuery = params.get('query');
    router.push(existingQuery ? `/search?query=${encodeURIComponent(existingQuery)}` : '/search');
  };

  return (
    <Card className="h-fit lg:sticky lg:top-24">
      <CardContent className="p-5">
        <form onSubmit={apply} className="flex flex-col gap-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-brand-ink-muted">
            {t('filters')}
          </h2>

          <div className="flex flex-col gap-1">
            <label htmlFor="filter-category" className="text-sm font-medium text-brand-ink">
              {t('filterCategory')}
            </label>
            <select
              id="filter-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-11 rounded-md border border-line bg-surface px-3 text-sm text-brand-ink focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
            >
              <option value="">{t('allCategories')}</option>
              {CATEGORY_KEYS.map((key) => (
                <option key={key} value={tcat(key)}>
                  {tcat(key)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('filterPriceMin')}
              inputMode="decimal"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              error={priceError}
            />
            <Input
              label={t('filterPriceMax')}
              inputMode="decimal"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </div>

          <Input
            label={t('filterMinQty')}
            inputMode="numeric"
            value={minQty}
            onChange={(e) => setMinQty(e.target.value)}
          />

          <div className="flex gap-2">
            <Button type="submit" size="sm" className="flex-1">
              {t('applyFilters')}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={clear}>
              {t('clearFilters')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
