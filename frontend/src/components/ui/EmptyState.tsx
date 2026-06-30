import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Calm, branded empty state used across lists (cart, orders, search, supplier views). */
export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line bg-surface px-6 py-16 text-center',
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-pill bg-brand-primary-100 text-brand-primary">
        {icon ?? (
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <rect x="3" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M3 9h16M8 13h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <h3 className="font-display text-lg font-semibold text-brand-ink">{title}</h3>
      {description ? <p className="max-w-md text-sm text-brand-ink-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
