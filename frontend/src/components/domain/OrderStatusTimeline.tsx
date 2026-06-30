'use client';

import { useFormatter, useTranslations } from 'next-intl';
import type { OrderStatus, StatusHistoryEntry } from '@/lib/api/types';
import { cn } from '@/lib/cn';

const FLOW: OrderStatus[] = ['CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED'];

/**
 * Vertical fulfilment timeline (Req 13.1–13.3). Highlights reached states and shows the timestamp
 * of each recorded change; cancelled sub-orders render a single cancelled marker.
 */
export function OrderStatusTimeline({
  status,
  history,
}: {
  status: OrderStatus;
  history?: StatusHistoryEntry[];
}) {
  const t = useTranslations('status');
  const format = useFormatter();

  const timeFor = (s: OrderStatus): string | null => {
    const entry = history?.find((h) => h.status === s);
    if (!entry) return null;
    return format.dateTime(new Date(entry.at), { dateStyle: 'medium', timeStyle: 'short' });
  };

  if (status === 'CANCELLED') {
    return (
      <ol className="space-y-3">
        <li className="flex items-start gap-3">
          <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-pill bg-danger text-[10px] text-white">
            ✕
          </span>
          <div>
            <p className="text-sm font-medium text-danger">{t('CANCELLED')}</p>
            {timeFor('CANCELLED') ? (
              <p className="text-xs text-brand-ink-muted">{timeFor('CANCELLED')}</p>
            ) : null}
          </div>
        </li>
      </ol>
    );
  }

  const reachedIndex = FLOW.indexOf(status === 'PENDING' ? 'CONFIRMED' : status);
  const pending = status === 'PENDING';

  return (
    <ol className="space-y-1">
      {FLOW.map((step, idx) => {
        const reached = !pending && idx <= reachedIndex;
        const current = !pending && idx === reachedIndex;
        const time = timeFor(step);
        return (
          <li key={step} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-pill border-2 text-[10px]',
                  reached
                    ? 'border-brand-primary bg-brand-primary text-white'
                    : 'border-line bg-surface text-transparent',
                  current && 'animate-pulse-ring',
                )}
                aria-hidden="true"
              >
                ✓
              </span>
              {idx < FLOW.length - 1 ? (
                <span className={cn('h-6 w-0.5', reached ? 'bg-brand-primary' : 'bg-line')} />
              ) : null}
            </div>
            <div className="pb-2">
              <p
                className={cn(
                  'text-sm',
                  reached ? 'font-medium text-brand-ink' : 'text-brand-ink-muted',
                )}
              >
                {t(step)}
              </p>
              {time ? <p className="text-xs text-brand-ink-muted">{time}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
