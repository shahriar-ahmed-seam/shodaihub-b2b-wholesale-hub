'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { StarRating } from './StarRating';
import { bff } from '@/lib/api/browser';
import { ApiError } from '@/lib/api/client';
import { useRouter } from '@/i18n/routing';

/**
 * Product review submission (Req 15.1). A 1–5 rating plus optional text. Eligibility (a delivered
 * sub-order) is enforced by the server; an eligibility rejection is surfaced inline via toast.
 */
export function ReviewForm({ productId }: { productId: string }) {
  const t = useTranslations('product');
  const tc = useTranslations('common');
  const { notify } = useToast();
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await bff(`/products/${productId}/reviews`, { method: 'POST', body: { rating, text: text.trim() || undefined } });
      notify({ title: t('writeReview'), tone: 'success' });
      setText('');
      router.refresh();
    } catch (err) {
      notify({ title: tc('error'), description: err instanceof ApiError ? err.message : '', tone: 'danger' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border border-line p-4">
      <p className="text-sm font-medium text-brand-ink">{t('writeReview')}</p>
      <StarRating value={rating} onChange={setRating} ariaLabel={t('averageRating')} />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="w-full rounded-md border border-line bg-surface p-3 text-sm text-brand-ink focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
        placeholder={t('writeReview')}
      />
      <div>
        <Button size="sm" onClick={submit} disabled={submitting}>
          {tc('submit')}
        </Button>
      </div>
    </div>
  );
}
