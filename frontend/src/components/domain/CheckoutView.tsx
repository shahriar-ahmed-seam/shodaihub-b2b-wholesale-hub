'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { CurrencyAmount } from '@/components/ui/CurrencyAmount';
import { EmptyState } from '@/components/ui/EmptyState';
import { Thumb } from '@/components/ui/Thumb';
import { StoreIcon, ShoppingCartIcon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { PaymentProviderPicker } from './PaymentProviderPicker';
import { bff } from '@/lib/api/browser';
import { ApiError } from '@/lib/api/client';
import type { Cart, PaymentProvider } from '@/lib/api/types';

interface CheckoutResult {
  orderId: string;
  subOrders: Array<{ id: string; status: string }>;
}

interface InitiateResult {
  checkoutUrl?: string;
  txnId: string;
}

/**
 * Checkout review + payment (Req 10.1, 10.7, 11.1, 11.2). Shows each supplier sub-order and the
 * order total, requires a single payment provider, then creates the order and initiates payment.
 * On success the user is redirected to the provider checkout URL (or the order page as fallback).
 */
export function CheckoutView({ initialCart }: { initialCart: Cart }) {
  const t = useTranslations('checkout');
  const tcart = useTranslations('cart');
  const tc = useTranslations('common');
  const { notify } = useToast();
  const router = useRouter();
  const [provider, setProvider] = useState<PaymentProvider | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (initialCart.groups.length === 0) {
    return (
      <EmptyState
        title={tcart('empty')}
        description={tcart('emptyHint')}
        icon={<ShoppingCartIcon className="h-6 w-6" />}
        action={
          <Button asChild>
            <Link href="/search">{tc('search')}</Link>
          </Button>
        }
      />
    );
  }

  const pay = async () => {
    if (!provider) return;
    setSubmitting(true);
    try {
      const order = await bff<CheckoutResult>('/checkout', { method: 'POST', body: {} });
      const init = await bff<InitiateResult>('/payments/initiate', {
        method: 'POST',
        body: { orderId: order.orderId, provider },
      });
      if (init.checkoutUrl) {
        window.location.href = init.checkoutUrl;
        return;
      }
      router.push(`/orders/${order.orderId}`);
    } catch (err) {
      notify({ title: tc('error'), description: err instanceof ApiError ? err.message : '', tone: 'danger' });
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-4">
        {initialCart.groups.map((group, idx) => (
          <Card key={group.supplierId}>
            <CardHeader className="flex-row items-center justify-between border-b border-line pb-4">
              <div>
                <p className="text-2xs uppercase tracking-wide text-brand-ink-muted">
                  {t('subOrder')} {idx + 1}
                </p>
                <p className="flex items-center gap-1.5 font-display font-semibold text-brand-ink">
                  <StoreIcon className="h-4 w-4 text-brand-primary" />
                  {group.supplierName}
                </p>
              </div>
              <CurrencyAmount amount={group.subtotal} emphasis />
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-line p-0">
              {group.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="flex items-center gap-3 text-brand-ink">
                    <Thumb src={item.imageUrl} alt={item.productName} size="sm" />
                    <span>
                      {item.productName} × {item.quantity}
                    </span>
                  </span>
                  <CurrencyAmount amount={item.subtotal} />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Card>
          <CardContent className="flex flex-col gap-5 p-6">
            <div className="flex items-center justify-between">
              <span className="font-display text-base font-semibold text-brand-ink">
                {t('orderTotal')}
              </span>
              <CurrencyAmount amount={initialCart.combinedTotal} emphasis className="text-lg" />
            </div>
            <PaymentProviderPicker value={provider} onChange={setProvider} />
            <Button
              size="lg"
              variant="accent"
              className="w-full"
              disabled={!provider || submitting}
              onClick={pay}
            >
              {t('payNow')}
            </Button>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
