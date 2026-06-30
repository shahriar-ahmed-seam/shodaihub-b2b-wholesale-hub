'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { Link } from '@/i18n/routing';

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  /**
   * Link mode (server-rendered lists): the base path for page links, e.g. `/search`. The current
   * page is appended as `?...&page=N`. Use {@link query} to preserve other params. Passing a
   * serializable base path (rather than a function) keeps this safe to render from Server
   * Components, which may not pass function props to Client Components.
   */
  basePath?: string;
  /** Link mode: extra query params to preserve on each page link (serializable). */
  query?: Record<string, string | number | undefined>;
  /** Button mode: callback when a page is chosen (client-controlled lists). */
  onPageChange?: (page: number) => void;
  className?: string;
}

/**
 * Accessible pager (Req 8.7, 13.4). Renders as a `<nav>` with anchors (link mode) or buttons
 * (callback mode). Clamps to the valid page range and disables prev/next at the bounds.
 */
export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  query,
  onPageChange,
  className,
}: PaginationProps) {
  const t = useTranslations('common');
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  if (totalPages <= 1) return null;

  const pages = pageWindow(page, totalPages);
  const isLink = typeof basePath === 'string';

  /** Build a serializable href for a page, preserving any extra query params. */
  const hrefForPage = (p: number): string => {
    const sp = new URLSearchParams();
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== '') sp.set(key, String(value));
      }
    }
    sp.set('page', String(p));
    return `${basePath}?${sp.toString()}`;
  };

  const baseClasses =
    'inline-flex h-9 min-w-9 items-center justify-center rounded-sm border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40';

  const renderPage = (p: number, label?: string, disabled?: boolean, active?: boolean) => {
    const classes = cn(
      baseClasses,
      active
        ? 'border-brand-primary bg-brand-primary text-white'
        : 'border-line bg-surface text-brand-ink hover:bg-surface-muted',
      disabled && 'pointer-events-none opacity-40',
    );
    const content = label ?? String(p);
    if (isLink) {
      return (
        <Link
          key={`${label ?? p}-${p}`}
          href={hrefForPage(p)}
          aria-current={active ? 'page' : undefined}
          aria-disabled={disabled}
          className={classes}
        >
          {content}
        </Link>
      );
    }
    return (
      <button
        key={`${label ?? p}-${p}`}
        type="button"
        onClick={() => onPageChange?.(p)}
        disabled={disabled}
        aria-current={active ? 'page' : undefined}
        className={classes}
      >
        {content}
      </button>
    );
  };

  return (
    <nav aria-label="Pagination" className={cn('flex flex-wrap items-center gap-2', className)}>
      {renderPage(page - 1, t('previous'), page <= 1)}
      {pages.map((p) => renderPage(p, undefined, false, p === page))}
      {renderPage(page + 1, t('next'), page >= totalPages)}
    </nav>
  );
}

/** Compute a compact window of page numbers around the current page. */
function pageWindow(current: number, totalPages: number): number[] {
  const span = 2;
  const start = Math.max(1, current - span);
  const end = Math.min(totalPages, current + span);
  const out: number[] = [];
  for (let p = start; p <= end; p += 1) out.push(p);
  return out;
}
