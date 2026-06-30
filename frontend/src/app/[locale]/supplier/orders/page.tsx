import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FulfillmentBoard } from '@/components/domain/FulfillmentBoard';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { TruckIcon } from '@/components/ui/Icon';
import { getSupplierSubOrders } from '@/lib/api/services';

export const dynamic = 'force-dynamic';

export default async function SupplierOrdersPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations('supplier');
  const tc = await getTranslations('common');
  const subOrders = await getSupplierSubOrders();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('fulfillment')} />
      {subOrders.length === 0 ? (
        <EmptyState title={tc('empty')} icon={<TruckIcon className="h-6 w-6" />} />
      ) : (
        <FulfillmentBoard subOrders={subOrders} />
      )}
    </div>
  );
}
