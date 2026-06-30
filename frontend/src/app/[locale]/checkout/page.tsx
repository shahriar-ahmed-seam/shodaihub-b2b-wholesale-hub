import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CheckoutView } from '@/components/domain/CheckoutView';
import { PageHeader } from '@/components/ui/PageHeader';
import { getCart } from '@/lib/api/services';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations('checkout');
  const cart = await getCart();

  return (
    <div className="container-page py-10">
      <PageHeader title={t('title')} description={t('reviewSubtitle')} />
      <div className="mt-8">
        <CheckoutView initialCart={cart} />
      </div>
    </div>
  );
}
