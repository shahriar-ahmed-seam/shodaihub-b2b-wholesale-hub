import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AddToCart } from '@/components/domain/AddToCart';
import { ReviewForm } from '@/components/domain/ReviewForm';
import { StarRating } from '@/components/domain/StarRating';
import { TierTable } from '@/components/domain/TierTable';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { CurrencyAmount } from '@/components/ui/CurrencyAmount';
import { getProduct } from '@/lib/api/services';

export const dynamic = 'force-dynamic';

export default async function ProductPage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  setRequestLocale(params.locale);
  const t = await getTranslations('product');
  const product = await getProduct(params.id);

  if (!product) {
    notFound();
  }

  const outOfStock = product.status === 'OUT_OF_STOCK' || (product.stock ?? 0) <= 0;
  const tiers = product.tiers ?? [];

  return (
    <div className="container-page py-10">
      <div className="grid gap-10 lg:grid-cols-2">
        {/* Gallery */}
        <div>
          <div className="overflow-hidden rounded-lg border border-line bg-brand-primary-100">
            <div className="flex aspect-square items-center justify-center bg-gradient-to-br from-brand-primary-100 to-surface-sunken">
              {product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <span className="font-display text-6xl font-semibold text-brand-primary/40">
                  {product.name.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Detail */}
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span className="text-2xs font-semibold uppercase tracking-wide text-brand-ink-muted">
              {product.category}
            </span>
            <h1 className="font-display text-3xl font-bold text-brand-ink">{product.name}</h1>
            {product.supplierName ? (
              <p className="text-sm text-brand-ink-muted">
                {t('soldBy')} <span className="font-medium text-brand-ink">{product.supplierName}</span>
              </p>
            ) : null}
            {product.reviewCount ? (
              <div className="flex items-center gap-2">
                <StarRating value={Math.round(product.averageRating ?? 0)} />
                <span className="text-sm text-brand-ink-muted">
                  {(product.averageRating ?? 0).toFixed(1)} · {product.reviewCount}
                </span>
              </div>
            ) : null}
          </div>

          {product.description ? (
            <p className="text-sm leading-relaxed text-brand-ink-muted">{product.description}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-2xs uppercase tracking-wide text-brand-ink-muted">{t('basePrice')}</p>
              <CurrencyAmount amount={product.basePrice} emphasis className="text-2xl" />
            </div>
            <Badge tone={outOfStock ? 'danger' : 'success'}>
              {outOfStock ? t('outOfStock') : t('inStock')}
            </Badge>
            <span className="text-sm text-brand-ink-muted">
              {t('stock')}: {product.sellableQty ?? product.stock}
            </span>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('pricingTiers')}</CardTitle>
            </CardHeader>
            <CardContent>
              {tiers.length ? (
                <TierTable tiers={tiers} />
              ) : (
                <p className="text-sm text-brand-ink-muted">{t('basePrice')}</p>
              )}
            </CardContent>
          </Card>

          <AddToCart
            productId={product.id}
            moq={product.moq}
            basePrice={product.basePrice}
            tiers={tiers}
            disabled={outOfStock}
          />
        </div>
      </div>

      {/* Reviews */}
      <section className="mt-12">
        <h2 className="font-display text-xl font-bold text-brand-ink">{t('reviews')}</h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="flex flex-col gap-3">
            {product.reviews?.length ? (
              product.reviews.map((review) => (
                <div key={review.id} className="rounded-md border border-line p-4">
                  <div className="flex items-center justify-between">
                    <StarRating value={review.rating} />
                    {review.retailerName ? (
                      <span className="text-xs text-brand-ink-muted">{review.retailerName}</span>
                    ) : null}
                  </div>
                  {review.text ? (
                    <p className="mt-2 text-sm text-brand-ink-muted">{review.text}</p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-brand-ink-muted">{t('noReviews')}</p>
            )}
          </div>
          <ReviewForm productId={product.id} />
        </div>
      </section>
    </div>
  );
}
