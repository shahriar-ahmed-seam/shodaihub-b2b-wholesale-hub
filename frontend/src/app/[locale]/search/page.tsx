import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ProductCard } from '@/components/domain/ProductCard';
import { SearchFilters } from '@/components/domain/SearchFilters';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { searchProducts } from '@/lib/api/services';

export const dynamic = 'force-dynamic';

type SearchPageParams = {
  query?: string;
  category?: string;
  minPrice?: string;
  maxPrice?: string;
  minQty?: string;
  page?: string;
};

function num(value?: string): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: SearchPageParams;
}) {
  setRequestLocale(params.locale);
  const t = await getTranslations('search');

  const page = Math.max(1, num(searchParams.page) ?? 1);
  const pageSize = 20;
  const results = await searchProducts({
    query: searchParams.query,
    category: searchParams.category,
    minPrice: num(searchParams.minPrice),
    maxPrice: num(searchParams.maxPrice),
    minQty: num(searchParams.minQty),
    page,
    pageSize,
  });

  const hasQuery = Boolean(searchParams.query?.trim());

  // Preserve all active filters on page links (serializable — no function crosses to the client).
  const pageQuery: Record<string, string> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    if (key !== 'page' && value) pageQuery[key] = value;
  }

  return (
    <div className="container-page py-10">
      <PageHeader
        title={hasQuery ? t('resultsFor', { query: searchParams.query! }) : t('title')}
        description={t('resultCount', { count: results.total })}
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr]">
        <SearchFilters />

        <div>
          {results.items.length === 0 ? (
            <EmptyState title={t('noResults')} description={t('noResultsHint')} />
          ) : (
            <>
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {results.items.map((product) => (
                  <li key={product.id}>
                    <ProductCard product={product} />
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Pagination
                  page={results.page}
                  pageSize={results.pageSize}
                  total={results.total}
                  basePath="/search"
                  query={pageQuery}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
