'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { bff } from '@/lib/api/browser';
import { ApiError } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { validateTiers, type TierDraft, type TierIssue } from '@/lib/pricing';
import type { PricingTier } from '@/lib/api/types';

/**
 * Supplier tier editor with LIVE overlap validation mirroring Property 3 (design: TierEditor).
 * As tiers are edited, {@link validateTiers} flags overlapping inclusive ranges, inverted ranges,
 * and out-of-bound qty/price client-side. Submission is blocked while issues exist; the server
 * remains authoritative and its rejection is surfaced via toast.
 */
export function TierEditor({
  productId,
  initialTiers,
}: {
  productId: string;
  initialTiers: PricingTier[];
}) {
  const t = useTranslations('supplier');
  const tc = useTranslations('common');
  const { notify } = useToast();
  const [tiers, setTiers] = useState<TierDraft[]>(
    initialTiers.length
      ? initialTiers.map((tier) => ({ minQty: tier.minQty, maxQty: tier.maxQty, unitPrice: tier.unitPrice }))
      : [{ minQty: '', maxQty: '', unitPrice: '' }],
  );
  const [saving, setSaving] = useState(false);

  const issues = useMemo(() => validateTiers(tiers), [tiers]);
  const issuesByIndex = useMemo(() => groupIssues(issues), [issues]);
  const hasBlockingIssue = issues.length > 0;

  const update = (index: number, field: keyof TierDraft, raw: string) => {
    setTiers((prev) =>
      prev.map((tier, i) =>
        i === index ? { ...tier, [field]: raw === '' ? '' : Number(raw) } : tier,
      ),
    );
  };

  const addRow = () => setTiers((prev) => [...prev, { minQty: '', maxQty: '', unitPrice: '' }]);
  const removeRow = (index: number) => setTiers((prev) => prev.filter((_, i) => i !== index));

  const save = async () => {
    if (hasBlockingIssue) return;
    setSaving(true);
    try {
      const complete = tiers.filter(
        (tier): tier is { minQty: number; maxQty: number; unitPrice: number } =>
          tier.minQty !== '' && tier.maxQty !== '' && tier.unitPrice !== '',
      );
      await bff(`/products/${productId}/tiers`, { method: 'POST', body: { tiers: complete } });
      notify({ title: tc('save'), tone: 'success' });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : tc('error');
      notify({ title: tc('error'), description: message, tone: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-2xs uppercase tracking-wide text-brand-ink-muted">
              <th className="px-3 py-2 font-semibold">{t('tierMinQty')}</th>
              <th className="px-3 py-2 font-semibold">{t('tierMaxQty')}</th>
              <th className="px-3 py-2 font-semibold">{t('tierUnitPrice')}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {tiers.map((tier, index) => {
              const rowIssues = issuesByIndex.get(index) ?? [];
              const overlap = rowIssues.find((i) => i.kind === 'overlap');
              const range = rowIssues.find((i) => i.kind === 'range');
              const invalid = rowIssues.length > 0;
              return (
                <tr key={index} className="align-top">
                  <td className="px-3 py-2">
                    <input
                      inputMode="numeric"
                      aria-label={`${t('tierMinQty')} ${index + 1}`}
                      value={tier.minQty}
                      onChange={(e) => update(index, 'minQty', e.target.value)}
                      className={cn(inputCls, invalid && 'border-danger')}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      inputMode="numeric"
                      aria-label={`${t('tierMaxQty')} ${index + 1}`}
                      value={tier.maxQty}
                      onChange={(e) => update(index, 'maxQty', e.target.value)}
                      className={cn(inputCls, invalid && 'border-danger')}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      inputMode="decimal"
                      aria-label={`${t('tierUnitPrice')} ${index + 1}`}
                      value={tier.unitPrice}
                      onChange={(e) => update(index, 'unitPrice', e.target.value)}
                      className={cn(inputCls, invalid && 'border-danger')}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="text-sm text-brand-ink-muted hover:text-danger"
                      aria-label={`${tc('remove')} ${index + 1}`}
                    >
                      ✕
                    </button>
                    {overlap ? (
                      <p className="mt-1 text-xs font-medium text-danger">{t('tierOverlap')}</p>
                    ) : range ? (
                      <p className="mt-1 text-xs font-medium text-danger">{t('tierRangeInvalid')}</p>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={addRow}>
          {t('addTier')}
        </Button>
        <Button size="sm" onClick={save} disabled={hasBlockingIssue || saving}>
          {tc('save')}
        </Button>
      </div>
    </div>
  );
}

const inputCls =
  'h-10 w-28 rounded-md border border-line bg-surface px-3 text-sm text-brand-ink focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30';

function groupIssues(issues: TierIssue[]): Map<number, TierIssue[]> {
  const map = new Map<number, TierIssue[]>();
  for (const issue of issues) {
    const list = map.get(issue.index) ?? [];
    list.push(issue);
    map.set(issue.index, list);
  }
  return map;
}
