import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CartView } from '@/components/domain/CartView';
import { PageHeader } from '@/components/ui/PageHeader';
import { getCart } from '@/lib/api/services';

export const dynamic = 'force-dynamic';

export default async function CartPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations('cart');
  const cart = await getCart();

  return (
    <div className="container-page py-10">
      <PageHeader title={t('title')} />
      <div className="mt-8">
        <CartView initialCart={cart} />
      </div>
    </div>
  );
}
