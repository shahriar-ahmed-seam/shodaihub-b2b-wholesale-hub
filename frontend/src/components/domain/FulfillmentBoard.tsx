'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { CurrencyAmount } from '@/components/ui/CurrencyAmount';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { StatusBadge } from './StatusBadge';
import { Thumb } from '@/components/ui/Thumb';
import { PackageIcon, BoxIcon, TruckIcon, CheckIcon, type IconProps } from '@/components/ui/Icon';
import { bff } from '@/lib/api/browser';
import { ApiError } from '@/lib/api/client';
import { useRouter } from '@/i18n/routing';
import type { OrderStatus, SubOrder } from '@/lib/api/types';

/**
 * Supplier fulfilment board (Req 12.1–12.3). Groups sub-orders into Kanban-style columns by status
 * and exposes the valid next transition (pack → ship[+tracking] → deliver). Invalid transitions are
 * never offered; the server still enforces the state machine and any rejection is toasted.
 */
const COLUMNS: OrderStatus[] = ['CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED'];

const COLUMN_ICON: Record<string, (props: IconProps) => JSX.Element> = {
  CONFIRMED: PackageIcon,
  PACKED: BoxIcon,
  SHIPPED: TruckIcon,
  DELIVERED: CheckIcon,
};

export function FulfillmentBoard({ subOrders }: { subOrders: SubOrder[] }) {
  const t = useTranslations('supplier');
  const ts = useTranslations('status');
  const tc = useTranslations('common');
  const { notify } = useToast();
  const router = useRouter();
  const [shipFor, setShipFor] = useState<SubOrder | null>(null);
  const [tracking, setTracking] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (id: string, action: 'pack' | 'ship' | 'deliver', body?: unknown) => {
    setBusy(id);
    try {
      await bff(`/suborders/${id}/${action}`, { method: 'POST', body });
      notify({ title: ts(nextStatus(action)), tone: 'success' });
      router.refresh();
    } catch (err) {
      notify({ title: tc('error'), description: err instanceof ApiError ? err.message : '', tone: 'danger' });
    } finally {
      setBusy(null);
      setShipFor(null);
      setTracking('');
    }
  };

  const grouped = COLUMNS.map((status) => ({
    status,
    items: subOrders.filter((s) => s.status === status),
  }));

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {grouped.map((column) => {
          const ColumnIcon = COLUMN_ICON[column.status] ?? PackageIcon;
          return (
            <section key={column.status} aria-label={ts(column.status)} className="flex flex-col gap-3">
              <header className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ColumnIcon className="h-4 w-4 text-brand-primary" />
                  <StatusBadge status={column.status} />
                </span>
                <span className="text-xs text-brand-ink-muted">{column.items.length}</span>
              </header>
              <div className="flex flex-col gap-3">
                {column.items.map((sub) => (
                  <Card key={sub.id}>
                    <CardContent className="flex flex-col gap-2 p-4">
                      <p className="font-mono text-xs text-brand-ink-muted">#{sub.id.slice(0, 8)}</p>
                      {sub.lines.length > 0 ? (
                        <div className="flex items-center gap-1.5">
                          {sub.lines.slice(0, 2).map((line) => (
                            <Thumb
                              key={line.productId}
                              src={line.imageUrl}
                              alt={line.productName}
                              size="sm"
                            />
                          ))}
                          {sub.lines.length > 2 ? (
                            <span className="text-xs text-brand-ink-muted">
                              +{sub.lines.length - 2}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      <p className="text-sm font-medium text-brand-ink">
                        {sub.lines.length} {tc('quantity').toLowerCase()} · <CurrencyAmount amount={sub.total} />
                      </p>
                      {sub.trackingRef ? (
                        <p className="text-xs text-brand-ink-muted">{sub.trackingRef}</p>
                      ) : null}
                      {column.status === 'CONFIRMED' ? (
                        <Button size="sm" disabled={busy === sub.id} onClick={() => act(sub.id, 'pack')}>
                          {t('markPacked')}
                        </Button>
                      ) : null}
                      {column.status === 'PACKED' ? (
                        <Button size="sm" disabled={busy === sub.id} onClick={() => setShipFor(sub)}>
                          {t('markShipped')}
                        </Button>
                      ) : null}
                      {column.status === 'SHIPPED' ? (
                        <Button
                          size="sm"
                          variant="accent"
                          disabled={busy === sub.id}
                          onClick={() => act(sub.id, 'deliver')}
                        >
                          {t('markDelivered')}
                        </Button>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
                {column.items.length === 0 ? (
                  <p className="rounded-md border border-dashed border-line px-3 py-6 text-center text-xs text-brand-ink-muted">
                    {tc('empty')}
                  </p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      <Modal
        open={shipFor !== null}
        onOpenChange={(open) => !open && setShipFor(null)}
        title={t('markShipped')}
        description={t('trackingPrompt')}
        footer={
          <>
            <Button variant="outline" onClick={() => setShipFor(null)}>
              {tc('cancel')}
            </Button>
            <Button
              disabled={!tracking.trim() || busy === shipFor?.id}
              onClick={() => shipFor && act(shipFor.id, 'ship', { trackingRef: tracking.trim() })}
            >
              {t('markShipped')}
            </Button>
          </>
        }
      >
        <Input
          label={t('trackingPrompt')}
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          autoFocus
        />
      </Modal>
    </>
  );
}

function nextStatus(action: 'pack' | 'ship' | 'deliver'): OrderStatus {
  if (action === 'pack') return 'PACKED';
  if (action === 'ship') return 'SHIPPED';
  return 'DELIVERED';
}
