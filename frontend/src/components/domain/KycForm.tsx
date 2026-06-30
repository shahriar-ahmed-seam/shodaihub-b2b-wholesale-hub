'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { bff } from '@/lib/api/browser';
import { ApiError } from '@/lib/api/client';
import { useRouter } from '@/i18n/routing';

/**
 * Supplier KYC submission form (Req 3.1). On submit, posts business name, trade license, and bank
 * account to the BFF; success transitions the supplier to UNDER_REVIEW and refreshes the view.
 */
export function KycForm({ defaultBusinessName = '' }: { defaultBusinessName?: string }) {
  const t = useTranslations('supplier');
  const tc = useTranslations('common');
  const { notify } = useToast();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSubmitting(true);
    try {
      await bff('/suppliers/kyc', {
        method: 'POST',
        body: {
          businessName: form.get('businessName'),
          tradeLicense: form.get('tradeLicense'),
          bankAccount: form.get('bankAccount'),
        },
      });
      notify({ title: t('kycSubmit'), tone: 'success' });
      router.refresh();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : tc('error');
      notify({ title: tc('error'), description: message, tone: 'danger' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex max-w-lg flex-col gap-4">
      <Input
        name="businessName"
        label={t('kyc')}
        defaultValue={defaultBusinessName}
        required
        minLength={1}
        maxLength={200}
      />
      <Input name="tradeLicense" label={t('tradeLicense')} required />
      <Input name="bankAccount" label={t('bankAccount')} required />
      <div>
        <Button type="submit" disabled={submitting}>
          {t('kycSubmit')}
        </Button>
      </div>
    </form>
  );
}
