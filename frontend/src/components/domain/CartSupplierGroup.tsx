'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { CurrencyAmount } from '@/components/ui/CurrencyAmount';
import { ReservationCountdown } from './ReservationCountdown';
import { Thumb } from '@/components/ui/Thumb';
import { StoreIcon } from '@/components/ui/Icon';
import type { CartSupplierGroup as CartGroup, CartLineItem } from '@/lib/api/types';
import { cn } from '@/lib/cn';

export interface CartSupplierGroupProps {
  group: CartGroup;
  pendingItemId?: string | null;
  onQtyChange: (item: CartLineItem, quantity: number) => void;
  onRemove: (item: CartLineItem) => void;
  onRenew: (item: CartLineItem) => void;
}

/**
 * One supplier's slice of the multi-vendor cart (Req 9.4): line items with qty steppers, removal,
 * a per-item reservation countdown (Req 7.9), and the supplier subtotal (Req 9.6).
 */
export function CartSupplierGroup({
  group,
  pendingItemId,
  onQtyChange,
  onRemove,
  onRenew,
}: CartSupplierGroupProps) {
  const t = useTranslations('cart');
  const tc = useTranslations('common');

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between border-b border-line pb-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-primary-100 text-brand-primary">
            <StoreIcon className="h-5 w-5" />
          </span>
          <span className="font-display font-semibold text-brand-ink">{group.supplierName}</span>
        </div>
        <span className="text-sm text-brand-ink-muted">
          {t('supplierSubtotal')}: <CurrencyAmount amount={group.subtotal} emphasis />
        </span>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-line p-0">
        {group.items.map((item) => {
          const pending = pendingItemId === item.id;
          return (
            <div key={item.id} className={cn('flex flex-col gap-3 p-4 sm:flex-row sm:items-center', pending && 'opacity-60')}>
              <div className="flex flex-1 items-center gap-3">
                <Thumb src={item.imageUrl} alt={item.productName} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-brand-ink">{item.productName}</p>
                  <p className="text-xs text-brand-ink-muted">
                    <CurrencyAmount amount={item.unitPrice} /> {tc('perUnit')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex items-center rounded-md border border-line">
                  <button
                    type="button"
                    className="h-10 w-10 text-brand-ink-muted hover:text-brand-ink disabled:opacity-40"
                    aria-label={tc('previous')}
                    disabled={pending || item.quantity <= 1}
                    onClick={() => onQtyChange(item, item.quantity - 1)}
                  >
                    −
                  </button>
                  <span className="w-12 text-center text-sm tabular-nums" aria-live="polite">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    className="h-10 w-10 text-brand-ink-muted hover:text-brand-ink disabled:opacity-40"
                    aria-label={tc('next')}
                    disabled={pending}
                    onClick={() => onQtyChange(item, item.quantity + 1)}
                  >
                    +
                  </button>
                </div>
                <span className="w-24 text-right text-sm">
                  <CurrencyAmount amount={item.subtotal} emphasis />
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                <ReservationCountdown
                  expiresAt={item.reservationExpiresAt}
                  renewalCount={item.renewalCount}
                  onRenew={() => onRenew(item)}
                  renewing={pending}
                />
                <Button variant="ghost" size="sm" onClick={() => onRemove(item)} disabled={pending}>
                  {t('removeItem')}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
