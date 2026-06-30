'use client';

import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

/**
 * Accessible modal dialog built on Radix (focus trap, ESC to close, scroll lock, ARIA wiring).
 * Used for confirmations like KYC reject reason and admin moderation.
 */
export function Modal({ open, onOpenChange, title, description, children, footer, className }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-brand-ink/40 backdrop-blur-sm animate-fade-in" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2',
            'rounded-lg border border-line bg-surface p-6 shadow-lg animate-fade-in focus:outline-none',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Dialog.Title className="font-display text-lg font-semibold text-brand-ink">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="text-sm text-brand-ink-muted">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close
              className="rounded-sm p-1 text-brand-ink-muted hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
              aria-label="Close"
            >
              <CloseIcon />
            </Dialog.Close>
          </div>
          {children ? <div className="mt-4">{children}</div> : null}
          {footer ? <div className="mt-6 flex justify-end gap-3">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
