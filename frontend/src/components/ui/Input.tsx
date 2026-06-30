import { forwardRef, type InputHTMLAttributes, useId } from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

/**
 * Labelled text input with inline hint + error messaging. The label is associated via `htmlFor`,
 * and the error is exposed through `aria-describedby` + `aria-invalid` for screen readers.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, hint, error, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <label htmlFor={inputId} className="text-sm font-medium text-brand-ink">
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'h-11 w-full rounded-md border border-line bg-surface px-3 text-sm text-brand-ink placeholder:text-brand-ink-muted/60',
          'transition-colors focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30',
          error && 'border-danger focus-visible:border-danger focus-visible:ring-danger/30',
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-brand-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
