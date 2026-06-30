'use client';

import { useTranslations } from 'next-intl';
import { CurrencyAmount } from '@/components/ui/CurrencyAmount';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import type { PricingTier } from '@/lib/api/types';

/** Read-only volume-pricing table shown on the product detail page (Req 5.1, 5.6). */
export function TierTable({ tiers }: { tiers: PricingTier[] }) {
  const t = useTranslations('product');
  if (!tiers.length) return null;

  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);

  return (
    <Table>
      <THead>
        <TR>
          <TH>{t('tierRange')}</TH>
          <TH className="text-right">{t('tierPrice')}</TH>
        </TR>
      </THead>
      <TBody>
        {sorted.map((tier) => (
          <TR key={`${tier.minQty}-${tier.maxQty}`}>
            <TD>
              {tier.minQty.toLocaleString()} – {tier.maxQty.toLocaleString()}
            </TD>
            <TD className="text-right">
              <CurrencyAmount amount={tier.unitPrice} />
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
