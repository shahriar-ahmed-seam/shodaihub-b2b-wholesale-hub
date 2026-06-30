import { getTranslations, setRequestLocale } from 'next-intl/server';
import { KycForm } from '@/components/domain/KycForm';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { getSupplierProfile } from '@/lib/api/services';

export const dynamic = 'force-dynamic';

const statusTone: Record<string, NonNullable<BadgeProps['tone']>> = {
  VERIFIED: 'success',
  UNDER_REVIEW: 'warning',
  PENDING_VERIFICATION: 'neutral',
  REJECTED: 'danger',
};

export default async function SupplierKycPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations('supplier');
  const profile = await getSupplierProfile();
  const verification = profile?.verificationStatus ?? 'PENDING_VERIFICATION';

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={t('kyc')}
        actions={
          <Badge tone={statusTone[verification] ?? 'neutral'}>{verification.replace(/_/g, ' ')}</Badge>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('kyc')}</CardTitle>
        </CardHeader>
        <CardContent>
          <KycForm defaultBusinessName={profile?.businessName} />
        </CardContent>
      </Card>
    </div>
  );
}
