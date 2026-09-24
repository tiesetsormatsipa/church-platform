import { Container } from '@church/ui/container';
import Link from 'next/link';
import type { BranchSummary, PublicOrganization } from '@/lib/data';
import { BrandMark } from './brand-mark';
import { PRIMARY_NAV } from './nav';

export function SiteFooter({ organization, branches }: { organization: PublicOrganization; branches: BranchSummary[] }) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <Container className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-3 lg:col-span-2">
          <div className="flex items-center gap-2.5">
            <BrandMark />
            <p className="font-serif text-lg font-semibold">{organization.shortName ?? organization.name}</p>
          </div>
          {organization.shortName ? <p className="text-sm text-muted">{organization.name}</p> : null}
          {organization.tagline ? <p className="max-w-sm text-sm text-muted">{organization.tagline}</p> : null}
          <ul className="flex flex-col gap-1 text-sm text-muted">
            {organization.email ? (
              <li>
                <a className="hover:text-foreground" href={`mailto:${organization.email}`}>
                  {organization.email}
                </a>
              </li>
            ) : null}
            {organization.phone ? <li>{organization.phone}</li> : null}
          </ul>
        </div>
        <nav aria-label="Explore">
          <p className="mb-3 text-sm font-semibold">Explore</p>
          <ul className="flex flex-col gap-2 text-sm text-muted">
            {PRIMARY_NAV.map((item) => (
              <li key={item.href}>
                <Link className="hover:text-foreground" href={item.href}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Branches">
          <p className="mb-3 text-sm font-semibold">Branches</p>
          <ul className="flex flex-col gap-2 text-sm text-muted">
            {branches.slice(0, 8).map((b) => (
              <li key={b.slug}>
                <Link className="hover:text-foreground" href={`/branches/${b.slug}`}>
                  {b.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
      <Container className="flex flex-col gap-2 border-t border-border py-6 text-xs text-subtle sm:flex-row sm:justify-between">
        <p>
          © {year} {organization.name}
        </p>
        <ul className="flex gap-4">
          <li>
            <Link className="hover:text-foreground" href="/privacy">
              Privacy
            </Link>
          </li>
          <li>
            <Link className="hover:text-foreground" href="/terms">
              Terms
            </Link>
          </li>
        </ul>
      </Container>
    </footer>
  );
}
