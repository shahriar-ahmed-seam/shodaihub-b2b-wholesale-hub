'use client';

import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/cn';

export interface SectionNavItem {
  href: string;
  label: string;
}

/**
 * Horizontal section navigation for the supplier/admin workspaces. Marks the active item by
 * matching the locale-stripped pathname suffix.
 */
export function SectionNav({ items }: { items: SectionNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Section"
      className="flex gap-1 overflow-x-auto border-b border-line [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item) => {
        const active = pathname.endsWith(item.href) || pathname.includes(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              '-mb-px shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-brand-ink-muted hover:text-brand-ink',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
