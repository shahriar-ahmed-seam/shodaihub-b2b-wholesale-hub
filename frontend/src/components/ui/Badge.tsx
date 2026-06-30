import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/** Compact status/label pill. Tones map to the semantic palette (success/warning/danger/info). */
export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-xs font-semibold leading-5',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-sunken text-brand-ink-muted',
        brand: 'bg-brand-primary-100 text-brand-primary',
        accent: 'bg-brand-accent-100 text-brand-accent-600',
        success: 'bg-[#E3F3EB] text-success',
        warning: 'bg-[#FBEEDB] text-warning',
        danger: 'bg-[#FBE6E3] text-danger',
        info: 'bg-[#E2ECF7] text-info',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
