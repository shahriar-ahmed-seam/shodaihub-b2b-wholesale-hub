import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { Card, CardContent } from '@/components/ui/Card';
import { CurrencyAmount } from '@/components/ui/CurrencyAmount';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { PackageIcon } from '@/components/ui/Icon';
import { getOrders } from '@/lib/api/services';

export const dynamic = 'force-dynamic';

export default async function OrdersPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { page?: string };
}) {
  setRequestLocale(params.locale);
  const t = await getTranslations('orders');
  const format = await getFormatter();

  const page = Math.max(1, Number(searchParams.page) || 1);
  const pageSize = 10;
  const orders = await getOrders(page, pageSize);

  return (
    <div className="container-page py-10">
      <PageHeader title={t('title')} />

      <div className="mt-8">
        {orders.items.length === 0 ? (
          <EmptyState title={t('empty')} icon={<PackageIcon className="h-6 w-6" />} />
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {orders.items.map((order) => (
                <li key={order.id}>
                  <Link href={`/orders/${order.id}`} className="block focus-visible:outline-none">
                    <Card className="transition-shadow hover:shadow-md">
                      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-primary-100 text-brand-primary">
                            <PackageIcon className="h-5 w-5" />
                          </span>
                          <div>
                            <p className="font-mono text-sm font-medium text-brand-ink">
                              {t('orderId')} #{order.id.slice(0, 8)}
                            </p>
                            <p className="text-xs text-brand-ink-muted">
                              {t('placedOn')}{' '}
                              {format.dateTime(new Date(order.placedAt), { dateStyle: 'medium' })}
                            </p>
                          </div>
                        </div>
                        <StatusBadge status={order.latestStatus} />
                        <CurrencyAmount amount={order.total} emphasis />
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Pagination
                page={orders.page}
                pageSize={orders.pageSize}
                total={orders.total}
                basePath="/orders"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
