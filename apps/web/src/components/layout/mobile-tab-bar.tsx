'use client';

import { cn } from '@church/ui/lib/cn';
import { Sheet, SheetContent, SheetTrigger } from '@church/ui/sheet';
import { Bell, Ellipsis, LayoutDashboard, LogIn, Search, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { withBranch } from '@/lib/context';
import { hasAdminAccess, useSession } from '@/lib/hooks/use-session';
import { isActive, PRIMARY_NAV, TAB_BAR_HREFS } from './nav';

function TabBar() {
  const pathname = usePathname();
  const branch = useSearchParams().get('branch');
  const { user } = useSession();
  const [moreOpen, setMoreOpen] = useState(false);
  const tabs = PRIMARY_NAV.filter((i) => TAB_BAR_HREFS.includes(i.href));
  const more = PRIMARY_NAV.filter((i) => !TAB_BAR_HREFS.includes(i.href));
  const moreActive = more.some((i) => isActive(pathname, i.href));

  const tabClass = (active: boolean) =>
    cn(
      'flex h-full flex-1 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium transition-colors [&_svg]:size-5',
      active ? 'text-link' : 'text-muted',
    );
  const rowClass = 'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium hover:bg-surface-muted [&_svg]:size-5 [&_svg]:text-muted';

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur md:hidden"
    >
      <ul className="flex h-16 items-stretch">
        {tabs.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex flex-1">
              <Link href={withBranch(item.href, branch)} aria-current={active ? 'page' : undefined} className={tabClass(active)}>
                <Icon aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
        <li className="flex flex-1">
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger className={tabClass(moreActive)}>
              <Ellipsis aria-hidden="true" />
              More
            </SheetTrigger>
            <SheetContent title="More">
              <ul className="flex flex-col gap-0.5">
                {more.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.contextual ? withBranch(item.href, branch) : item.href}
                        aria-current={isActive(pathname, item.href) ? 'page' : undefined}
                        onClick={() => setMoreOpen(false)}
                        className={rowClass}
                      >
                        <Icon aria-hidden="true" /> {item.label}
                      </Link>
                    </li>
                  );
                })}
                <li>
                  <Link href="/search" onClick={() => setMoreOpen(false)} className={rowClass}>
                    <Search aria-hidden="true" /> Search
                  </Link>
                </li>
              </ul>
              <hr className="my-3 border-border" />
              <ul className="flex flex-col gap-0.5">
                {user ? (
                  <>
                    <li>
                      <Link href="/notifications" onClick={() => setMoreOpen(false)} className={rowClass}>
                        <Bell aria-hidden="true" /> Notifications
                      </Link>
                    </li>
                    <li>
                      <Link href="/profile" onClick={() => setMoreOpen(false)} className={rowClass}>
                        <UserRound aria-hidden="true" /> Profile and settings
                      </Link>
                    </li>
                    {hasAdminAccess(user) ? (
                      <li>
                        <Link href="/admin" onClick={() => setMoreOpen(false)} className={rowClass}>
                          <LayoutDashboard aria-hidden="true" /> Administration
                        </Link>
                      </li>
                    ) : null}
                  </>
                ) : (
                  <li>
                    <Link href="/sign-in" onClick={() => setMoreOpen(false)} className={rowClass}>
                      <LogIn aria-hidden="true" /> Sign in or create an account
                    </Link>
                  </li>
                )}
              </ul>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}

/** Bottom navigation for phones (thumb reach); hidden from md upwards. */
export function MobileTabBar() {
  return (
    <Suspense fallback={null}>
      <TabBar />
    </Suspense>
  );
}
