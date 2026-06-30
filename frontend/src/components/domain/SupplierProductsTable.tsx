'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CurrencyAmount } from '@/components/ui/CurrencyAmount';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import { Thumb } from '@/components/ui/Thumb';
import { bff } from '@/lib/api/browser';
import { ApiError } from '@/lib/api/client';
import type { Product } from '@/lib/api/types';

/**
 * Supplier product listing with publish/unpublish (Req 4.4, 4.6) and a link to the tier editor
 * (Req 5). Publishing is gated server-side by supplier verification (Req 3.2/4.4); a rejection is
 * surfaced via toast.
 */
export function SupplierProductsTable({ products }: { products: Product[] }) {
  const t = useTranslations('supplier');
  const tp = useTranslations('product');
  const tc = useTranslations('common');
  const { notify } = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (product: Product) => {
    const publish = product.status !== 'PUBLISHED';
    setBusy(product.id);
    try {
      await bff(`/products/${product.id}/${publish ? 'publish' : 'unpublish'}`, { method: 'POST' });
      notify({ title: publish ? t('publish') : t('unpublish'), tone: 'success' });
      router.refresh();
    } catch (err) {
      notify({ title: tc('error'), description: err instanceof ApiError ? err.message : '', tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Table className="min-w-[640px]">
      <THead>
        <TR>
          <TH>{tc('search')}</TH>
          <TH>{tc('category')}</TH>
          <TH className="text-right">{tp('basePrice')}</TH>
          <TH>{tc('status')}</TH>
          <TH className="text-right">{tc('actions')}</TH>
        </TR>
      </THead>
      <TBody>
        {products.map((product) => (
          <TR key={product.id}>
            <TD className="font-medium">
              <span className="flex items-center gap-3">
                <Thumb src={product.imageUrl} alt={product.name} size="sm" />
                <span>{product.name}</span>
              </span>
            </TD>
            <TD className="text-brand-ink-muted">{product.category}</TD>
            <TD className="text-right">
              <CurrencyAmount amount={product.basePrice} />
            </TD>
            <TD>
              <Badge tone={product.status === 'PUBLISHED' ? 'success' : 'neutral'}>
                {product.status.replace(/_/g, ' ')}
              </Badge>
            </TD>
            <TD>
              <div className="flex items-center justify-end gap-2">
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/supplier/products/${product.id}/pricing`}>{t('editPricing')}</Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy === product.id}
                  onClick={() => toggle(product)}
                >
                  {product.status === 'PUBLISHED' ? t('unpublish') : t('publish')}
                </Button>
              </div>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
