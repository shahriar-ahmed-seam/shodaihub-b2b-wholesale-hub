'use client';

import { useTranslations } from 'next-intl';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
import type { OrderStatus } from '@/lib/api/types';

const toneByStatus: Record<OrderStatus, NonNullable<BadgeProps['tone']>> = {
  PENDING: 'warning',
  CONFIRMED: 'info',
  PACKED: 'brand',
  SHIPPED: 'accent',
  DELIVERED: 'success',
  CANCELLED: 'danger',
};

/** Translated, semantically-toned badge for a sub-order status (Req 13.1, 17.1). */
export function StatusBadge({ status }: { status: OrderStatus }) {
  const t = useTranslations('status');
  return <Badge tone={toneByStatus[status]}>{t(status)}</Badge>;
}
