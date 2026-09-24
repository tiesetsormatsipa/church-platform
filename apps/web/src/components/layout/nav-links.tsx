'use client';

import { cn } from '@church/ui/lib/cn';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { withBranch } from '@/lib/context';
import { isActive, PRIMARY_NAV } from './nav';

/** Desktop primary navigation; keeps the branch context on contextual pages. */
export function NavLinks() {
  const pathname = usePathname();
  const branch = useSearchParams().get('branch');
  return (
    <nav aria-label="Main" className="hidden lg:block">
      <ul className="flex items-center gap-0.5">
        {PRIMARY_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.contextual ? withBranch(item.href, branch) : item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary-soft text-primary-soft-foreground'
                    : 'text-muted hover:bg-surface-muted hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
