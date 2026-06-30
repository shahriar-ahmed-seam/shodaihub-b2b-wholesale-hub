'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/Button';
import { CurrencyAmount } from '@/components/ui/CurrencyAmount';
import { useToast } from '@/components/ui/Toast';
import { bff } from '@/lib/api/browser';
import { ApiError } from '@/lib/api/client';
import { resolveUnitPrice } from '@/lib/pricing';
import type { PricingTier } from '@/lib/api/types';

/**
 * Quantity selector + add-to-cart (Req 9.1, 9.2). Enforces MOQ client-side (server is
 * authoritative) and previews the live tier-resolved unit price (Req 5.6) as quantity changes.
 */
export function AddToCart({
  productId,
  moq,
  basePrice,
  tiers,
  disabled,
}: {
  productId: string;
  moq: number;
  basePrice: number;
  tiers: PricingTier[];
  disabled?: boolean;
}) {
  const t = useTranslations('product');
  const tc = useTranslations('common');
  const { notify } = useToast();
  const router = useRouter();
  const [quantity, setQuantity] = useState(moq);
  const [adding, setAdding] = useState(false);

  const belowMoq = quantity < moq;
  const unitPrice = resolveUnitPrice(quantity, basePrice, tiers);
  const subtotal = Math.round(unitPrice * quantity * 100) / 100;

  const add = async () => {
    if (belowMoq) return;
    setAdding(true);
    try {
      await bff('/cart/items', { method: 'POST', body: { productId, quantity } });
      notify({ title: t('addedToCart'), tone: 'success' });
      router.push('/cart');
    } catch (err) {
      notify({
        title: tc('error'),
        description: err instanceof ApiError ? err.message : '',
        tone: 'danger',
      });
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <label htmlFor="qty" className="text-sm font-medium text-brand-ink">
          {tc('quantity')}
        </label>
        <input
          id="qty"
          type="number"
          min={1}
          inputMode="numeric"
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
          aria-invalid={belowMoq}
          aria-describedby={belowMoq ? 'qty-error' : undefined}
          className="h-11 w-28 rounded-md border border-line bg-surface px-3 text-sm text-brand-ink focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 aria-[invalid=true]:border-danger"
        />
        <div className="text-sm text-brand-ink-muted">
          <CurrencyAmount amount={unitPrice} /> {tc('perUnit')}
        </div>
      </div>

      {belowMoq ? (
        <p id="qty-error" className="text-xs font-medium text-danger">
          {t('quantityBelowMoq', { moq })}
        </p>
      ) : (
        <p className="text-sm text-brand-ink-muted">
          {tc('subtotal')}: <CurrencyAmount amount={subtotal} emphasis />
        </p>
      )}

      <Button size="lg" variant="accent" onClick={add} disabled={belowMoq || adding || disabled}>
        {t('addToCart')}
      </Button>
    </div>
  );
}
