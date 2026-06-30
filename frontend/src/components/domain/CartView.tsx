'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { CurrencyAmount } from '@/components/ui/CurrencyAmount';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { CartSupplierGroup } from './CartSupplierGroup';
import { ShoppingCartIcon } from '@/components/ui/Icon';
import { bff } from '@/lib/api/browser';
import { ApiError } from '@/lib/api/client';
import type { Cart, CartLineItem } from '@/lib/api/types';

const CART_KEY = ['cart'];

/**
 * Client cart orchestrator (Req 9.4–9.6, 7.6, 7.9). Reads the server-authoritative cart via React
 * Query and performs qty change / removal / reservation renew mutations through the BFF proxy,
 * invalidating the cache after each so totals and countdowns stay consistent.
 */
export function CartView({ initialCart }: { initialCart: Cart }) {
  const t = useTranslations('cart');
  const tc = useTranslations('common');
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);

  const { data: cart } = useQuery({
    queryKey: CART_KEY,
    queryFn: () => bff<Cart>('/cart'),
    initialData: initialCart,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: CART_KEY });

  const onError = (err: unknown) => {
    notify({ title: tc('error'), description: err instanceof ApiError ? err.message : '', tone: 'danger' });
  };

  const qtyMutation = useMutation({
    mutationFn: ({ item, quantity }: { item: CartLineItem; quantity: number }) =>
      bff(`/cart/items/${item.id}`, { method: 'PUT', body: { quantity } }),
    onMutate: ({ item }) => setPendingItemId(item.id),
    onError,
    onSettled: () => {
      setPendingItemId(null);
      invalidate();
    },
  });

  const removeMutation = useMutation({
    mutationFn: (item: CartLineItem) => bff(`/cart/items/${item.id}`, { method: 'DELETE' }),
    onMutate: (item) => setPendingItemId(item.id),
    onSuccess: () => notify({ title: t('removeItem'), tone: 'success' }),
    onError,
    onSettled: () => {
      setPendingItemId(null);
      invalidate();
    },
  });

  const renewMutation = useMutation({
    mutationFn: (item: CartLineItem) =>
      bff(`/cart/reservations/${item.reservationId}/renew`, { method: 'POST' }),
    onMutate: (item) => setPendingItemId(item.id),
    onSuccess: () => notify({ title: t('renew'), tone: 'success' }),
    onError,
    onSettled: () => {
      setPendingItemId(null);
      invalidate();
    },
  });

  if (!cart || cart.groups.length === 0) {
    return (
      <EmptyState
        title={t('empty')}
        description={t('emptyHint')}
        icon={<ShoppingCartIcon className="h-6 w-6" />}
        action={
          <Button asChild>
            <Link href="/search">{tc('search')}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-4">
        {cart.groups.map((group) => (
          <CartSupplierGroup
            key={group.supplierId}
            group={group}
            pendingItemId={pendingItemId}
            onQtyChange={(item, quantity) => quantity >= 1 && qtyMutation.mutate({ item, quantity })}
            onRemove={(item) => removeMutation.mutate(item)}
            onRenew={(item) => renewMutation.mutate(item)}
          />
        ))}
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Card>
          <CardContent className="flex flex-col gap-4 p-6">
            <h2 className="font-display text-lg font-semibold text-brand-ink">{t('title')}</h2>
            <dl className="flex flex-col gap-2 text-sm">
              {cart.groups.map((group) => (
                <div key={group.supplierId} className="flex justify-between text-brand-ink-muted">
                  <dt className="truncate pr-2">{group.supplierName}</dt>
                  <dd>
                    <CurrencyAmount amount={group.subtotal} />
                  </dd>
                </div>
              ))}
              <div className="mt-2 flex justify-between border-t border-line pt-3 text-base">
                <dt className="font-semibold text-brand-ink">{t('combinedTotal')}</dt>
                <dd>
                  <CurrencyAmount amount={cart.combinedTotal} emphasis />
                </dd>
              </div>
            </dl>
            <Button asChild size="lg" variant="accent" className="w-full">
              <Link href="/checkout">{t('checkout')}</Link>
            </Button>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
