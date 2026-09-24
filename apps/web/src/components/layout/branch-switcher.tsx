'use client';

import { cn } from '@church/ui/lib/cn';
import { Popover, PopoverContent, PopoverTrigger } from '@church/ui/popover';
import { Sheet, SheetContent, SheetTrigger } from '@church/ui/sheet';
import { Check, ChevronDown, Globe, MapPin } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { withBranch } from '@/lib/context';
import { CONTEXTUAL_PATHS } from './nav';

export interface SwitcherBranch {
  slug: string;
  name: string;
  city: string | null;
  province: string | null;
}

const PREFERENCE_COOKIE = 'cp_branch';

function rememberPreference(slug: string | null) {
  document.cookie = slug
    ? `${PREFERENCE_COOKIE}=${slug}; path=/; max-age=31536000; samesite=lax`
    : `${PREFERENCE_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

function useTarget() {
  const pathname = usePathname();
  const contextual = CONTEXTUAL_PATHS.includes(pathname);
  return (slug: string | null) => withBranch(contextual ? pathname : '/', slug);
}

function Options({
  branches,
  current,
  onChoose,
}: {
  branches: SwitcherBranch[];
  current: string | null;
  onChoose: () => void;
}) {
  const target = useTarget();
  const option = (slug: string | null, label: string, detail: string, icon: React.ReactNode) => {
    const active = current === slug;
    return (
      <li key={slug ?? 'global'}>
        <Link
          href={target(slug)}
          aria-current={active ? 'true' : undefined}
          onClick={() => {
            rememberPreference(slug);
            onChoose();
          }}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-muted',
            active && 'bg-primary-soft hover:bg-primary-soft',
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-full [&_svg]:size-4',
              slug
                ? 'bg-accent-soft text-accent-soft-foreground'
                : 'bg-primary-soft text-primary-soft-foreground',
            )}
          >
            {icon}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-medium text-foreground">{label}</span>
            <span className="truncate text-xs text-muted">{detail}</span>
          </span>
          {active ? <Check aria-hidden="true" className="size-4 text-link" /> : null}
        </Link>
      </li>
    );
  };
  return (
    <ul className="flex flex-col gap-0.5">
      {option(null, 'Global', 'The whole church: every branch', <Globe />)}
      {branches.map((b) =>
        option(
          b.slug,
          b.name,
          [b.city, b.province].filter(Boolean).join(', ') || 'Branch',
          <MapPin />,
        ),
      )}
    </ul>
  );
}

/**
 * Shows and changes the branch context ("Global" or one branch). The context lives in the
 * URL, so the choice is visible, shareable and never hidden in a cookie.
 */
export function BranchSwitcher({ branches }: { branches: SwitcherBranch[] }) {
  const current = useSearchParams().get('branch');
  const currentBranch = branches.find((b) => b.slug === current) ?? null;
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const label = currentBranch?.name ?? 'Global';
  const triggerClass =
    'inline-flex h-9 max-w-[9rem] items-center sm:max-w-[11rem] gap-1.5 rounded-full border border-border-strong bg-surface pr-2.5 pl-2 text-sm font-medium text-foreground shadow-card transition-colors hover:bg-surface-muted';
  const icon = currentBranch ? (
    <MapPin aria-hidden="true" className="size-4 shrink-0 text-accent-strong" />
  ) : (
    <Globe aria-hidden="true" className="size-4 shrink-0 text-link" />
  );

  return (
    <>
      <div className="hidden md:block">
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger className={triggerClass} aria-label={`Viewing ${label}. Change branch`}>
            {icon}
            <span className="truncate">{label}</span>
            <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted" />
          </PopoverTrigger>
          <PopoverContent title="Choose a branch" align="end" className="w-80">
            <p className="px-3 pt-1 pb-2 text-xs font-medium text-subtle">Show content for</p>
            <Options
              branches={branches}
              current={currentBranch?.slug ?? null}
              onChoose={() => setPopoverOpen(false)}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="md:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger className={triggerClass} aria-label={`Viewing ${label}. Change branch`}>
            {icon}
            <span className="truncate">{label}</span>
            <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted" />
          </SheetTrigger>
          <SheetContent title="Show content for" description="Church-wide news is always included.">
            <Options
              branches={branches}
              current={currentBranch?.slug ?? null}
              onChoose={() => setSheetOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
