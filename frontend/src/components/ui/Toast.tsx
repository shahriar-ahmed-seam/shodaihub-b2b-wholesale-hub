'use client';

import * as RToast from '@radix-ui/react-toast';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type ToastTone = 'default' | 'success' | 'danger' | 'info';

interface ToastMessage {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastContextValue {
  notify: (message: Omit<ToastMessage, 'id'> & { tone?: ToastTone }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Access the toast dispatcher. Throws if used outside the provider so misuse is caught early. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

const toneStyles: Record<ToastTone, string> = {
  default: 'border-line',
  success: 'border-success/40',
  danger: 'border-danger/40',
  info: 'border-info/40',
};

/**
 * App-wide toast provider built on Radix Toast (accessible live region, swipe-to-dismiss,
 * auto-timeout). Wrap the app once; call `useToast().notify(...)` to surface feedback.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const notify = useCallback<ToastContextValue['notify']>(({ tone = 'default', ...rest }) => {
    setMessages((prev) => [...prev, { id: Date.now() + Math.random(), tone, ...rest }]);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      <RToast.Provider swipeDirection="right" duration={5000}>
        {children}
        {messages.map((msg) => (
          <RToast.Root
            key={msg.id}
            onOpenChange={(open) => {
              if (!open) setMessages((prev) => prev.filter((m) => m.id !== msg.id));
            }}
            className={cn(
              'flex flex-col gap-1 rounded-md border-l-4 border bg-surface p-4 shadow-lg animate-slide-in',
              toneStyles[msg.tone],
            )}
          >
            <RToast.Title className="text-sm font-semibold text-brand-ink">{msg.title}</RToast.Title>
            {msg.description ? (
              <RToast.Description className="text-sm text-brand-ink-muted">
                {msg.description}
              </RToast.Description>
            ) : null}
          </RToast.Root>
        ))}
        <RToast.Viewport className="fixed bottom-0 right-0 z-[100] flex w-full max-w-sm flex-col gap-2 p-4 outline-none" />
      </RToast.Provider>
    </ToastContext.Provider>
  );
}
