'use client';

import * as RSelect from '@radix-ui/react-select';
import { forwardRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Accessible select built on Radix. Keyboard navigation, typeahead, and focus management come
 * from the primitive; styling follows the design tokens. Use via the re-exported parts.
 */
export interface SelectOption {
  value: string;
  label: ReactNode;
}

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  name?: string;
  id?: string;
  'aria-label'?: string;
  className?: string;
}

const ChevronIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  { value, defaultValue, onValueChange, options, placeholder, name, id, className, ...aria },
  ref,
) {
  return (
    <RSelect.Root value={value} defaultValue={defaultValue} onValueChange={onValueChange} name={name}>
      <RSelect.Trigger
        ref={ref}
        id={id}
        aria-label={aria['aria-label']}
        className={cn(
          'inline-flex h-11 w-full items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 text-sm text-brand-ink',
          'focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 data-[placeholder]:text-brand-ink-muted/60',
          className,
        )}
      >
        <RSelect.Value placeholder={placeholder} />
        <RSelect.Icon className="text-brand-ink-muted">
          <ChevronIcon />
        </RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content
          position="popper"
          sideOffset={4}
          className="z-50 overflow-hidden rounded-md border border-line bg-surface shadow-md animate-fade-in"
        >
          <RSelect.Viewport className="p-1">
            {options.map((opt) => (
              <RSelect.Item
                key={opt.value}
                value={opt.value}
                className="relative flex cursor-pointer select-none items-center rounded-sm px-3 py-2 text-sm text-brand-ink outline-none data-[highlighted]:bg-brand-primary-100 data-[state=checked]:font-semibold"
              >
                <RSelect.ItemText>{opt.label}</RSelect.ItemText>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
});
