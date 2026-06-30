import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { OrderStatusTimeline } from '@/components/domain/OrderStatusTimeline';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { CurrencyAmount } from '@/components/ui/CurrencyAmount';
import { PageHeader } from '@/components/ui/PageHeader';
import { Thumb } from '@/components/ui/Thumb';
import { StoreIcon, TruckIcon } from '@/components/ui/Icon';
import { getOrder } from '@/lib/api/services';

export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  setRequestLocale(params.locale);
  const t = await getTranslations('orders');
  const format = await getFormatter();
  const order = await getOrder(params.id);

  if (!order) {
    notFound();
  }

  return (
    <div className="container-page py-10">
      <PageHeader
        title={`${t('orderId')} #${order.id.slice(0, 8)}`}
        description={`${t('placedOn')} ${format.dateTime(new Date(order.placedAt), { dateStyle: 'long' })}`}
        actions={<CurrencyAmount amount={order.total} emphasis className="text-lg" />}
      />

      <div className="mt-8 flex flex-col gap-4">
        {order.subOrders.map((sub) => (
          <Card key={sub.id}>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
              <div>
                <p className="text-2xs uppercase tracking-wide text-brand-ink-muted">{t('supplier')}</p>
                <p className="flex items-center gap-1.5 font-display font-semibold text-brand-ink">
                  <StoreIcon className="h-4 w-4 text-brand-primary" />
                  {sub.supplierName}
                </p>
              </div>
              <StatusBadge status={sub.status} />
            </CardHeader>
            <CardContent className="grid gap-6 p-6 lg:grid-cols-[1fr_280px]">
              <div className="flex flex-col gap-3">
                <ul className="flex flex-col divide-y divide-line">
                  {sub.lines.map((line) => (
                    <li key={line.productId} className="flex items-center justify-between py-2 text-sm">
                      <span className="flex items-center gap-3 text-brand-ink">
                        <Thumb src={line.imageUrl} alt={line.productName} size="sm" />
                        <span>
                          {line.productName} × {line.quantity}
                        </span>
                      </span>
                      <CurrencyAmount amount={line.subtotal} />
                    </li>
                  ))}
                </ul>
                {sub.trackingRef ? (
                  <p className="flex items-center gap-1.5 text-sm text-brand-ink-muted">
                    <TruckIcon className="h-4 w-4 text-brand-primary" />
                    {t('trackingRef')}: <span className="font-medium text-brand-ink">{sub.trackingRef}</span>
                  </p>
                ) : null}
                {sub.lastUpdatedAt ? (
                  <p className="text-xs text-brand-ink-muted">
                    {t('lastUpdated')}:{' '}
                    {format.dateTime(new Date(sub.lastUpdatedAt), { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                ) : null}
              </div>
              <div>
                <p className="mb-3 text-2xs font-semibold uppercase tracking-wide text-brand-ink-muted">
                  {t('statusTimeline')}
                </p>
                <OrderStatusTimeline status={sub.status} history={sub.statusHistory} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
