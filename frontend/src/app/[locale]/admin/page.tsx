import { getTranslations, setRequestLocale } from 'next-intl/server';
import { KycQueuePanel } from '@/components/domain/admin/KycQueuePanel';
import {
  ProductReviewModerationPanel,
  UserModerationPanel,
} from '@/components/domain/admin/ModerationPanel';
import { Card, CardContent } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { UsersIcon, ShoppingCartIcon, PackageIcon, TagIcon } from '@/components/ui/Icon';
import { getAdminMetrics, getKycQueue } from '@/lib/api/services';

export const dynamic = 'force-dynamic';

export default async function AdminPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations('admin');

  const [metrics, kycQueue] = await Promise.all([getAdminMetrics(), getKycQueue()]);

  const metricCards = [
    { label: t('metricSuppliers'), value: metrics.suppliers, icon: UsersIcon },
    { label: t('metricRetailers'), value: metrics.retailers, icon: ShoppingCartIcon },
    { label: t('metricProducts'), value: metrics.products, icon: PackageIcon },
    { label: t('metricOrders'), value: metrics.orders, icon: TagIcon },
  ];

  return (
    <div className="container-page flex flex-col gap-8 py-10">
      <PageHeader title={t('title')} />

      <section aria-label={t('metrics')}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metricCards.map((card) => (
            <Card key={card.label}>
              <CardContent className="flex items-center gap-4 p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-md bg-brand-primary-100 text-brand-primary">
                  <card.icon className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-sm text-brand-ink-muted">{card.label}</p>
                  <p className="mt-1 font-display text-3xl font-bold text-brand-ink">{card.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Tabs
        items={[
          { value: 'kyc', label: t('kycQueue'), content: <KycQueuePanel submissions={kycQueue} /> },
          { value: 'users', label: t('users'), content: <UserModerationPanel /> },
          {
            value: 'content',
            label: t('productModeration'),
            content: <ProductReviewModerationPanel />,
          },
        ]}
      />
    </div>
  );
}
