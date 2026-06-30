'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { StoreIcon, ClipboardListIcon } from '@/components/ui/Icon';
import { bff } from '@/lib/api/browser';
import { ApiError } from '@/lib/api/client';
import { useRouter } from '@/i18n/routing';
import type { KycSubmission } from '@/lib/api/types';

/**
 * Admin KYC moderation (Req 16.1, 3.3, 3.4). Lists pending submissions and approves/rejects each;
 * rejection requires a reason captured in a modal and delivered to the supplier.
 */
export function KycQueuePanel({ submissions }: { submissions: KycSubmission[] }) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const { notify } = useToast();
  const router = useRouter();
  const [rejecting, setRejecting] = useState<KycSubmission | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const approve = async (s: KycSubmission) => {
    setBusy(s.supplierId);
    try {
      await bff(`/admin/suppliers/${s.supplierId}/kyc/approve`, { method: 'POST' });
      notify({ title: t('approve'), tone: 'success' });
      router.refresh();
    } catch (err) {
      notify({ title: tc('error'), description: err instanceof ApiError ? err.message : '', tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const reject = async () => {
    if (!rejecting) return;
    setBusy(rejecting.supplierId);
    try {
      await bff(`/admin/suppliers/${rejecting.supplierId}/kyc/reject`, {
        method: 'POST',
        body: { reason: reason.trim() },
      });
      notify({ title: t('reject'), tone: 'success' });
      router.refresh();
    } catch (err) {
      notify({ title: tc('error'), description: err instanceof ApiError ? err.message : '', tone: 'danger' });
    } finally {
      setBusy(null);
      setRejecting(null);
      setReason('');
    }
  };

  if (submissions.length === 0) {
    return (
      <EmptyState
        title={t('kycQueue')}
        description={tc('empty')}
        icon={<ClipboardListIcon className="h-6 w-6" />}
      />
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {submissions.map((s) => (
          <Card key={s.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-primary-100 text-brand-primary">
                  <StoreIcon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-medium text-brand-ink">{s.businessName}</p>
                  <p className="text-xs text-brand-ink-muted">
                    {s.tradeLicense} · {s.bankAccount}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={busy === s.supplierId} onClick={() => approve(s)}>
                  {t('approve')}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy === s.supplierId}
                  onClick={() => setRejecting(s)}
                >
                  {t('reject')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Modal
        open={rejecting !== null}
        onOpenChange={(open) => !open && setRejecting(null)}
        title={t('reject')}
        description={t('rejectReason')}
        footer={
          <>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              {tc('cancel')}
            </Button>
            <Button variant="danger" disabled={!reason.trim()} onClick={reject}>
              {t('reject')}
            </Button>
          </>
        }
      >
        <Input label={t('rejectReason')} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
      </Modal>
    </>
  );
}
