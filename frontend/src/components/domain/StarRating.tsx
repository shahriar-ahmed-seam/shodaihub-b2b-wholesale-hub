'use client';

import { cn } from '@/lib/cn';

const Star = ({ filled }: { filled: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path
      d="M9 2l2 4.3 4.7.6-3.5 3.2.9 4.6L9 12.5 4.9 14.7l.9-4.6L2.3 6.9 7 6.3 9 2z"
      fill={filled ? '#F2A516' : 'none'}
      stroke="#F2A516"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>
);

/** Read-only or interactive 1–5 star rating (Req 15.1). */
export function StarRating({
  value,
  onChange,
  ariaLabel,
}: {
  value: number;
  onChange?: (value: number) => void;
  ariaLabel?: string;
}) {
  const interactive = typeof onChange === 'function';
  return (
    <div role={interactive ? 'radiogroup' : 'img'} aria-label={ariaLabel} className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) =>
        interactive ? (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n}`}
            onClick={() => onChange?.(n)}
            className={cn('rounded-sm p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40')}
          >
            <Star filled={n <= value} />
          </button>
        ) : (
          <Star key={n} filled={n <= value} />
        ),
      )}
    </div>
  );
}
