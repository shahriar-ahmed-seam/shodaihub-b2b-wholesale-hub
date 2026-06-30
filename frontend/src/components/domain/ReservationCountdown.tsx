'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

const MAX_RENEWALS = 3;

function remainingMs(expiresAt: string): number {
  return Math.max(0, new Date(expiresAt).getTime() - Date.now());
}

function formatClock(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export interface ReservationCountdownProps {
  expiresAt: string;
  renewalCount: number;
  onRenew?: () => void;
  renewing?: boolean;
}

/**
 * 15-minute reservation timer with renew (Req 7.9, 7.10). Ticks each second; surfaces an expired
 * state at zero and disables renew once the 3-renewal cap is reached — mirroring the server cap so
 * the UI never invites a renewal the backend will reject.
 */
export function ReservationCountdown({
  expiresAt,
  renewalCount,
  onRenew,
  renewing,
}: ReservationCountdownProps) {
  const t = useTranslations('cart');
  const [ms, setMs] = useState(() => remainingMs(expiresAt));

  useEffect(() => {
    setMs(remainingMs(expiresAt));
    const id = setInterval(() => setMs(remainingMs(expiresAt)), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const expired = ms <= 0;
  const atCap = renewalCount >= MAX_RENEWALS;
  const urgent = !expired && ms < 60_000;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md bg-surface-muted px-3 py-2">
      <span
        className={cn(
          'flex items-center gap-1.5 text-sm font-medium tabular-nums',
          expired ? 'text-danger' : urgent ? 'text-warning' : 'text-brand-ink',
        )}
        role="timer"
        aria-live={urgent ? 'polite' : 'off'}
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
          <circle cx="7.5" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M7.5 5v3l2 1.5M7.5 1.5h0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        {expired ? t('expired') : t('reservationTime', { time: formatClock(ms) })}
      </span>
      {onRenew ? (
        <Button
          variant="outline"
          size="sm"
          onClick={onRenew}
          disabled={atCap || renewing}
          title={atCap ? t('renewLimit') : undefined}
        >
          {atCap ? t('renewLimit') : t('renew')}
        </Button>
      ) : null}
    </div>
  );
}
