import { buttonVariants } from '@church/ui/button';
import { Container } from '@church/ui/container';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import type { BranchSummary, PublicOrganization } from '@/lib/data';
import { AccountMenu } from './account-menu';
import { BranchSwitcher } from './branch-switcher';
import { BrandMark } from './brand-mark';
import { NavLinks } from './nav-links';

export function SiteHeader({ organization, branches }: { organization: PublicOrganization; branches: BranchSummary[] }) {
  const switcherBranches = branches.map((b) => ({ slug: b.slug, name: b.name, city: b.city, province: b.province }));
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <Container className="flex h-14 items-center gap-3 md:h-16">
        <Link href="/" className="flex min-w-0 items-center gap-2.5 rounded-lg" aria-label={`${organization.name}, home`}>
          <BrandMark />
          <span className="hidden min-w-0 flex-col leading-tight sm:flex">
            <span className="truncate font-serif text-base font-semibold text-foreground">
              {organization.shortName ?? organization.name}
            </span>
            {organization.shortName ? (
              <span className="hidden truncate text-xs text-muted xl:block">{organization.name}</span>
            ) : null}
          </span>
        </Link>
        <div className="flex-1 lg:flex lg:justify-center">
          <Suspense fallback={null}>
            <NavLinks />
          </Suspense>
        </div>
        <Suspense fallback={null}>
          <BranchSwitcher branches={switcherBranches} />
        </Suspense>
        <Link href="/search" aria-label="Search" className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
          <Search aria-hidden="true" />
        </Link>
        <AccountMenu />
      </Container>
    </header>
  );
}
