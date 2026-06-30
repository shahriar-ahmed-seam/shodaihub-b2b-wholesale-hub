import { cn } from '@/lib/cn';

/**
 * Square, rounded image thumbnail used across cart/checkout/order/fulfilment views. Renders the
 * product `imageUrl` (an Unsplash URL or the local `/api/placeholder` SVG) with object-cover; when
 * no src is provided it falls back to a branded tile showing the first initial of `alt`.
 */
const SIZES = {
  sm: 'h-9 w-9 text-sm',
  md: 'h-12 w-12 text-base',
  lg: 'h-16 w-16 text-lg',
} as const;

export interface ThumbProps {
  src?: string;
  alt: string;
  size?: keyof typeof SIZES;
  className?: string;
}

export function Thumb({ src, alt, size = 'md', className }: ThumbProps) {
  const base = cn(
    'shrink-0 overflow-hidden rounded-md bg-surface-sunken',
    SIZES[size],
    className,
  );

  if (!src) {
    const initial = alt.trim().slice(0, 1).toUpperCase() || '•';
    return (
      <span
        className={cn(
          base,
          'flex items-center justify-center font-display font-semibold text-brand-primary/50',
        )}
        aria-hidden="true"
      >
        {initial}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={cn(base, 'object-cover')} loading="lazy" />
  );
}
