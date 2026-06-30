import { getTranslations, setRequestLocale } from 'next-intl/server';
import { TierEditor } from '@/components/domain/TierEditor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { getSupplierProductWithTiers } from '@/lib/api/services';

export const dynamic = 'force-dynamic';

export default async function PricingPage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  setRequestLocale(params.locale);
  const t = await getTranslations('supplier');
  const product = await getSupplierProductWithTiers(params.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={product?.name ?? t('editPricing')} description={t('tierEditorTitle')} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('tierEditorTitle')}</CardTitle>
          <CardDescription>{t('tierOverlap')}</CardDescription>
        </CardHeader>
        <CardContent>
          <TierEditor productId={params.id} initialTiers={product?.tiers ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
