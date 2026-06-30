'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Badge } from '@/components/ui/Badge';
import { CurrencyAmount } from '@/components/ui/CurrencyAmount';
import type { Product } from '@/lib/api/types';

const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path
      d="M7 1.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6L7 9.9 3.8 11.9l.6-3.6L1.8 5.8l3.6-.5L7 1.5z"
      fill={filled ? '#F2A516' : 'none'}
      stroke="#F2A516"
      strokeWidth="1"
      strokeLinejoin="round"
    />
  </svg>
);

/** Catalogue card with a generated gradient thumbnail (no external image), price, MOQ, rating. */
export function ProductCard({ product }: { product: Product }) {
  const t = useTranslations('product');
  const outOfStock = product.status === 'OUT_OF_STOCK' || (product.stock ?? 0) <= 0;
  const rating = Math.round(product.averageRating ?? 0);

  return (
    <Link
      href={`/products/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-brand-primary-100">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-primary-100 to-surface-sunken">
            <span className="font-display text-3xl font-semibold text-brand-primary/40">
              {product.name.slice(0, 1).toUpperCase()}
            </span>
          </div>
        )}
        {outOfStock ? (
          <span className="absolute left-2 top-2">
            <Badge tone="danger">{t('outOfStock')}</Badge>
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-2xs font-semibold uppercase tracking-wide text-brand-ink-muted">
          {product.category}
        </p>
        <h3 className="line-clamp-2 text-sm font-semibold text-brand-ink">{product.name}</h3>
        <div className="mt-auto flex items-end justify-between gap-2">
          <div>
            <CurrencyAmount amount={product.basePrice} emphasis className="text-base" />
            <p className="text-2xs text-brand-ink-muted">
              {t('moq')}: {product.moq}
            </p>
          </div>
          {product.reviewCount ? (
            <div className="flex items-center gap-0.5" aria-label={`${t('averageRating')} ${rating}`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <StarIcon key={n} filled={n <= rating} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
