import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * Primary action primitive. Variants encode the restrained teal/amber palette: `primary` (teal)
 * for navigation/confirm, `accent` (amber) for the headline CTA, plus quiet/outline/ghost/danger.
 * Focus-visible rings and disabled states are built in for keyboard + AA accessibility.
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-brand-primary text-white hover:bg-brand-primary-600 active:bg-brand-primary-700 shadow-sm',
        accent: 'bg-brand-accent text-brand-ink hover:bg-brand-accent-600 shadow-sm',
        outline: 'border border-line bg-surface text-brand-ink hover:bg-surface-muted',
        ghost: 'text-brand-primary hover:bg-brand-primary-100',
        danger: 'bg-danger text-white hover:bg-[#a93226] shadow-sm',
        subtle: 'bg-brand-primary-100 text-brand-primary hover:bg-brand-primary-100/70',
      },
      size: {
        sm: 'h-9 rounded-sm px-3 text-sm',
        md: 'h-11 rounded-md px-4 text-sm',
        lg: 'h-12 rounded-md px-6 text-base',
        icon: 'h-10 w-10 rounded-md',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render as the child element (e.g. an anchor) while keeping button styling. */
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      type={asChild ? undefined : (type ?? 'button')}
      {...props}
    />
  );
});
