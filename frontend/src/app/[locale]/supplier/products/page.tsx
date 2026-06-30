import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SupplierProductsTable } from '@/components/domain/SupplierProductsTable';
import { Card, CardContent } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { PackageIcon } from '@/components/ui/Icon';
import { getSupplierProducts } from '@/lib/api/services';

export const dynamic = 'force-dynamic';

export default async function SupplierProductsPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { page?: string };
}) {
  setRequestLocale(params.locale);
  const t = await getTranslations('supplier');

  const page = Math.max(1, Number(searchParams.page) || 1);
  const products = await getSupplierProducts(page, 20);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('products')} />
      {products.items.length === 0 ? (
        <EmptyState title={t('products')} description={t('addProduct')} icon={<PackageIcon className="h-6 w-6" />} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <SupplierProductsTable products={products.items} />
          </CardContent>
        </Card>
      )}
      <Pagination
        page={products.page}
        pageSize={products.pageSize}
        total={products.total}
        basePath="/supplier/products"
      />
    </div>
  );
}
