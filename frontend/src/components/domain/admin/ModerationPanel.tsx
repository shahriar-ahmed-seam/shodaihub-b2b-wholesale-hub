'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { bff } from '@/lib/api/browser';
import { ApiError } from '@/lib/api/client';
import { useRouter } from '@/i18n/routing';

type ModerationAction = {
  title: string;
  description: string;
  inputLabel: string;
  buttonLabel: string;
  request: (id: string) => Promise<unknown>;
  danger?: boolean;
};

function ActionCard({ action }: { action: ModerationAction }) {
  const tc = useTranslations('common');
  const { notify } = useToast();
  const router = useRouter();
  const [id, setId] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!id.trim()) return;
    setBusy(true);
    try {
      await action.request(id.trim());
      notify({ title: action.buttonLabel, tone: 'success' });
      setId('');
      router.refresh();
    } catch (err) {
      notify({ title: tc('error'), description: err instanceof ApiError ? err.message : '', tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{action.title}</CardTitle>
        <CardDescription>{action.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:flex-1">
          <Input
            label={action.inputLabel}
            value={id}
            onChange={(e) => setId(e.target.value)}
            className="font-mono"
          />
        </div>
        <Button
          variant={action.danger ? 'danger' : 'primary'}
          disabled={!id.trim() || busy}
          onClick={run}
          className="w-full sm:w-auto"
        >
          {action.buttonLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Admin moderation actions (Req 16.2, 16.4, 15.4): suspend a user (revokes sessions), remove a
 * product (de-indexes), and remove a review (recalculates the average). Each acts on an entity id.
 */
export function UserModerationPanel() {
  const t = useTranslations('admin');
  return (
    <ActionCard
      action={{
        title: t('users'),
        description: t('suspend'),
        inputLabel: 'User ID',
        buttonLabel: t('suspend'),
        danger: true,
        request: (id) => bff(`/auth/admin/users/${id}/suspend`, { method: 'POST' }),
      }}
    />
  );
}

export function ProductReviewModerationPanel() {
  const t = useTranslations('admin');
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ActionCard
        action={{
          title: t('productModeration'),
          description: t('removeProduct'),
          inputLabel: 'Product ID',
          buttonLabel: t('removeProduct'),
          danger: true,
          request: (id) => bff(`/admin/products/${id}/remove`, { method: 'POST' }),
        }}
      />
      <ActionCard
        action={{
          title: t('reviewModeration'),
          description: t('removeReview'),
          inputLabel: 'Review ID',
          buttonLabel: t('removeReview'),
          danger: true,
          request: (id) => bff(`/admin/reviews/${id}`, { method: 'DELETE' }),
        }}
      />
    </div>
  );
}
