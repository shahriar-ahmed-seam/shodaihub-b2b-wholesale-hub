import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { PackageIcon, TruckIcon, UserCheckIcon } from '@/components/ui/Icon';
import { getSupplierProducts, getSupplierProfile, getSupplierSubOrders } from '@/lib/api/services';

export const dynamic = 'force-dynamic';

const statusTone: Record<string, NonNullable<BadgeProps['tone']>> = {
  VERIFIED: 'success',
  UNDER_REVIEW: 'warning',
  PENDING_VERIFICATION: 'neutral',
  REJECTED: 'danger',
};

export default async function SupplierDashboardPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations('supplier');

  const [profile, products, subOrders] = await Promise.all([
    getSupplierProfile(),
    getSupplierProducts(1, 1),
    getSupplierSubOrders(),
  ]);

  const publishedCount = products.total;
  const openOrders = subOrders.filter((s) => s.status !== 'DELIVERED' && s.status !== 'CANCELLED').length;
  const verification = profile?.verificationStatus ?? 'PENDING_VERIFICATION';

  const kpis = [
    { label: t('kpiProducts'), value: publishedCount, icon: PackageIcon },
    { label: t('kpiOrders'), value: openOrders, icon: TruckIcon },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t('dashboard')}
        actions={
          <Button asChild>
            <Link href="/supplier/products">{t('products')}</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="flex items-center gap-4 p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-md bg-brand-primary-100 text-brand-primary">
                <kpi.icon className="h-6 w-6" />
              </span>
              <div>
                <p className="text-sm text-brand-ink-muted">{kpi.label}</p>
                <p className="mt-1 font-display text-3xl font-bold text-brand-ink">{kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardContent className="flex flex-col gap-2 p-6">
            <p className="flex items-center gap-2 text-sm text-brand-ink-muted">
              <span className="flex h-11 w-11 items-center justify-center rounded-md bg-brand-primary-100 text-brand-primary">
                <UserCheckIcon className="h-6 w-6" />
              </span>
              {t('kycStatus')}
            </p>
            <Badge tone={statusTone[verification] ?? 'neutral'} className="w-fit">
              {verification.replace(/_/g, ' ')}
            </Badge>
            {verification !== 'VERIFIED' ? (
              <Link href="/supplier/kyc" className="link-underline text-sm">
                {t('kycSubmit')}
              </Link>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
