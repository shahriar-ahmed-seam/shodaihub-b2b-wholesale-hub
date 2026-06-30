import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { SectionNav } from '@/components/layout/SectionNav';

export default async function SupplierLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  setRequestLocale(params.locale);
  const t = await getTranslations('supplier');
  const tn = await getTranslations('nav');

  const items = [
    { href: '/supplier/dashboard', label: tn('dashboard') },
    { href: '/supplier/products', label: t('products') },
    { href: '/supplier/orders', label: t('orders') },
    { href: '/supplier/kyc', label: t('kyc') },
  ];

  return (
    <div className="container-page py-10">
      <SectionNav items={items} />
      <div className="mt-8">{children}</div>
    </div>
  );
}
