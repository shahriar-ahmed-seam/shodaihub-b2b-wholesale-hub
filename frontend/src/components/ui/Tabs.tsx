'use client';

import * as RTabs from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem {
  value: string;
  label: ReactNode;
  content: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  defaultValue?: string;
  className?: string;
}

/** Accessible tabbed panels (Radix) used for admin sections and supplier views. */
export function Tabs({ items, defaultValue, className }: TabsProps) {
  return (
    <RTabs.Root defaultValue={defaultValue ?? items[0]?.value} className={cn('w-full', className)}>
      <RTabs.List className="flex gap-1 overflow-x-auto border-b border-line [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <RTabs.Trigger
            key={item.value}
            value={item.value}
            className={cn(
              '-mb-px shrink-0 whitespace-nowrap rounded-t-sm border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-brand-ink-muted transition-colors',
              'hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40',
              'data-[state=active]:border-brand-primary data-[state=active]:text-brand-primary',
            )}
          >
            {item.label}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
      {items.map((item) => (
        <RTabs.Content key={item.value} value={item.value} className="pt-6 focus:outline-none">
          {item.content}
        </RTabs.Content>
      ))}
    </RTabs.Root>
  );
}
