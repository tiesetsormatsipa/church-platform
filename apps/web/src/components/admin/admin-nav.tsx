'use client';

import type { AdminSummary } from '@church/shared';
import { cn } from '@church/ui/lib/cn';
import {
  Building2,
  ClipboardList,
  FileText,
  LayoutDashboard,
  ScrollText,
  Settings,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Area = keyof AdminSummary['areas'];

const ITEMS: {
  href: string;
  label: string;
  icon: typeof FileText;
  area?: Area;
  count?: keyof AdminSummary['counts'];
}[] = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  {
    href: '/admin/content',
    label: 'Content',
    icon: FileText,
    area: 'content',
    count: 'contentAwaitingReview',
  },
  {
    href: '/admin/memberships',
    label: 'Memberships',
    icon: ClipboardList,
    area: 'memberships',
    count: 'pendingMemberships',
  },
  { href: '/admin/people', label: 'People and roles', icon: Users, area: 'people' },
  { href: '/admin/branches', label: 'Branches', icon: Building2, area: 'branches' },
  { href: '/admin/audit', label: 'Audit log', icon: ScrollText, area: 'audit' },
  { href: '/admin/settings', label: 'Settings', icon: Settings, area: 'settings' },
];

/** Section navigation: a sidebar on desktop, a scrollable row on phones. */
export function AdminNav({ summary }: { summary: AdminSummary }) {
  const pathname = usePathname();
  const items = ITEMS.filter((i) => !i.area || summary.areas[i.area]);
  return (
    <nav
      aria-label="Administration"
      className="relative -mx-4 scrollbar-none overflow-x-auto px-4 lg:mx-0 lg:px-0"
    >
      <ul className="flex gap-1 lg:flex-col">
        {items.map(({ href, label, icon: Icon, count }) => {
          const active = href === '/admin' ? pathname === href : pathname.startsWith(href);
          const badge = count ? summary.counts[count] : 0;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  // relative: keeps the sr-only badge text inside the scroll container.
                  'relative flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors',
                  active
                    ? 'bg-primary-soft text-primary-soft-foreground'
                    : 'text-muted hover:bg-surface-muted hover:text-foreground',
                )}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className="flex-1">{label}</span>
                {badge > 0 ? (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-soft-foreground tabular-nums">
                    {badge}
                    <span className="sr-only"> waiting</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
