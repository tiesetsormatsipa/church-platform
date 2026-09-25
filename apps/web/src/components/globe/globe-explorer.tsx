'use client';

import type { GeoBranch, GeoCountry, GeographyOverview } from '@church/shared';
import { BRANCH_TYPE_LABEL } from '@church/shared';
import { Avatar } from '@church/ui/avatar';
import { Badge } from '@church/ui/badge';
import { buttonVariants } from '@church/ui/button';
import { Input } from '@church/ui/input';
import { cn } from '@church/ui/lib/cn';
import { Droplets, MapPin, Search, Users } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import * as React from 'react';

// The canvas, d3 and the 108 KB world outline are worth nothing to a crawler and would
// block first paint, so they load after the page is interactive.
const GlobeCanvas = dynamic(() => import('./globe-canvas').then((m) => m.GlobeCanvas), {
  ssr: false,
  loading: () => (
    <div className="flex h-[360px] w-full items-center justify-center rounded-xl border border-border bg-surface-muted text-sm text-muted">
      Loading the globe…
    </div>
  ),
});

interface Props {
  overview: GeographyOverview;
}

/**
 * The way into the church's geography.
 *
 * The globe is the pleasure of it, but everything it shows is also a real list beside it:
 * that keeps the page usable by keyboard and screen reader, and it still works before the
 * canvas has loaded or if it never does.
 */
export function GlobeExplorer({ overview }: Props) {
  const { countries, branches } = overview;
  const [query, setQuery] = React.useState('');
  const [selected, setSelected] = React.useState<GeoBranch | null>(null);
  const [focus, setFocus] = React.useState<{
    longitude: number;
    latitude: number;
    zoom: number;
  } | null>(null);

  const byId = React.useMemo(() => new Map(branches.map((b) => [b.id, b])), [branches]);
  const hueOf = React.useMemo(() => new Map(countries.map((c) => [c.code, c.hue])), [countries]);

  const matches = React.useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return null;
    return branches.filter(
      (b) =>
        b.name.toLowerCase().includes(term) ||
        (b.city ?? '').toLowerCase().includes(term) ||
        (countries.find((c) => c.code === b.countryCode)?.name ?? '').toLowerCase().includes(term),
    );
  }, [query, branches, countries]);

  function showBranch(branch: GeoBranch) {
    setSelected(branch);
    if (branch.longitude !== null && branch.latitude !== null) {
      setFocus({ longitude: branch.longitude, latitude: branch.latitude, zoom: 2.6 });
    }
  }

  function showCountry(country: GeoCountry) {
    setSelected(null);
    setFocus({ longitude: country.longitude, latitude: country.latitude, zoom: 1.9 });
  }

  const children = selected ? branches.filter((b) => b.parentBranchId === selected.id) : [];
  const parent = selected?.parentBranchId ? byId.get(selected.parentBranchId) : undefined;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-10">
      <div className="flex flex-col gap-4">
        <div
          className="rounded-xl border border-border bg-surface p-2"
          style={
            {
              '--globe-ocean': '#0a1020',
              '--globe-land': '#243244',
              '--globe-land-line': '#3a4a5f',
              '--globe-label': '#f1f5f9',
            } as React.CSSProperties
          }
        >
          <GlobeCanvas
            countries={countries}
            branches={branches}
            selected={selected}
            onSelect={(b) => (b ? showBranch(b) : setSelected(null))}
            focus={focus}
          />
        </div>
        <p className="text-sm text-muted">
          Drag to turn the globe, scroll to zoom, and click a branch to see it. Larger dots are the
          main branches; the smaller ones are the branches beneath them.
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        <div>
          <label htmlFor="globe-search" className="text-sm font-medium">
            Find a town or city
          </label>
          <div className="relative mt-1.5">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            />
            <Input
              id="globe-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Kimberley, Windhoek, Cape Town…"
              className="ps-9"
              autoComplete="off"
            />
          </div>
        </div>

        {matches ? (
          <section aria-labelledby="matches-heading">
            <h2 id="matches-heading" className="text-sm font-semibold text-muted">
              {matches.length === 0
                ? `Nothing matches “${query.trim()}”`
                : `${matches.length} ${matches.length === 1 ? 'branch' : 'branches'}`}
            </h2>
            <ul className="mt-3 flex flex-col gap-1.5">
              {matches.map((branch) => (
                <li key={branch.id}>
                  <BranchButton
                    branch={branch}
                    hue={hueOf.get(branch.countryCode) ?? 210}
                    active={selected?.id === branch.id}
                    onClick={() => showBranch(branch)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : selected ? (
          <section
            aria-labelledby="branch-heading"
            className="rounded-xl border border-border bg-surface p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id="branch-heading" className="text-xl font-semibold">
                  {selected.name}
                </h2>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                  <MapPin aria-hidden="true" className="size-4 shrink-0" />
                  {[selected.city, countryName(countries, selected.countryCode)]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              </div>
              <Badge tone={selected.type === 'MAIN' ? 'primary' : 'neutral'}>
                {BRANCH_TYPE_LABEL[selected.type]}
              </Badge>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase">
                  <Users aria-hidden="true" className="size-3.5" /> Saints
                </dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">{selected.members}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase">
                  <Droplets aria-hidden="true" className="size-3.5" /> Baptised
                </dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">
                  {selected.baptisms.own}
                  {selected.baptisms.total !== selected.baptisms.own ? (
                    <span className="ms-2 text-sm font-normal text-muted">
                      {selected.baptisms.total} with its sub-branches
                    </span>
                  ) : null}
                </dd>
              </div>
            </dl>

            {parent ? (
              <p className="mt-4 text-sm text-muted">
                Under{' '}
                <button
                  type="button"
                  className="font-medium text-link underline"
                  onClick={() => showBranch(parent)}
                >
                  {parent.name}
                </button>
                .
              </p>
            ) : null}

            {children.length > 0 ? (
              <div className="mt-4">
                <h3 className="text-sm font-semibold">Branches under {selected.name}</h3>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {children.map((child) => (
                    <li key={child.id}>
                      <button
                        type="button"
                        onClick={() => showBranch(child)}
                        className="rounded-full border border-border px-3 py-1 text-sm hover:bg-surface-muted"
                      >
                        {child.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {selected.leaders.length > 0 ? (
              <div className="mt-5">
                <h3 className="text-sm font-semibold">Who to speak to</h3>
                <ul className="mt-2 flex flex-col gap-2">
                  {selected.leaders.map((leader) => (
                    <li key={`${leader.name}-${leader.title}`} className="flex items-center gap-3">
                      <Avatar name={leader.name} src={leader.photoUrl} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{leader.name}</span>
                        <span className="block truncate text-xs text-muted">{leader.title}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {selected.phone || selected.email ? (
              <ul className="mt-4 flex flex-col gap-1.5 text-sm">
                {selected.phone ? (
                  <li>
                    <a href={`tel:${selected.phone}`} className="text-link hover:underline">
                      {selected.phone}
                    </a>
                  </li>
                ) : null}
                {selected.email ? (
                  <li>
                    <a href={`mailto:${selected.email}`} className="text-link hover:underline">
                      {selected.email}
                    </a>
                  </li>
                ) : null}
              </ul>
            ) : null}

            <Link
              href={`/branches/${selected.slug}`}
              className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'mt-5')}
            >
              Service times and more
            </Link>
          </section>
        ) : (
          <section aria-labelledby="countries-heading">
            <h2 id="countries-heading" className="text-sm font-semibold text-muted">
              Countries the church is in
            </h2>
            <ul className="mt-3 flex flex-col gap-2">
              {countries.map((country) => (
                <li key={country.code}>
                  <button
                    type="button"
                    onClick={() => showCountry(country)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-start hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className="size-3 shrink-0 rounded-full"
                        style={{ backgroundColor: `hsl(${country.hue} 85% 60%)` }}
                      />
                      <span className="truncate font-medium">{country.name}</span>
                    </span>
                    <span className="shrink-0 text-sm text-muted">
                      {country.branchCount} {country.branchCount === 1 ? 'branch' : 'branches'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <h2 className="mt-6 text-sm font-semibold text-muted">Every branch</h2>
            <ul className="mt-3 flex flex-col gap-1.5">
              {branches
                .slice()
                .sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name))
                .map((branch) => (
                  <li key={branch.id} style={{ paddingInlineStart: `${branch.depth * 14}px` }}>
                    <BranchButton
                      branch={branch}
                      hue={hueOf.get(branch.countryCode) ?? 210}
                      active={false}
                      onClick={() => showBranch(branch)}
                    />
                  </li>
                ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function BranchButton({
  branch,
  hue,
  active,
  onClick,
}: {
  branch: GeoBranch;
  hue: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-sm hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        active && 'bg-surface-muted font-semibold',
      )}
    >
      <span
        aria-hidden="true"
        className="shrink-0 rounded-full"
        style={{
          backgroundColor: `hsl(${hue} 85% 60%)`,
          width: branch.type === 'MAIN' ? 11 : 7,
          height: branch.type === 'MAIN' ? 11 : 7,
        }}
      />
      <span className="truncate">{branch.name}</span>
      <span className="ms-auto shrink-0 text-xs text-muted">
        {branch.city ?? BRANCH_TYPE_LABEL[branch.type]}
      </span>
    </button>
  );
}

function countryName(countries: GeoCountry[], code: string): string {
  return countries.find((c) => c.code === code)?.name ?? code;
}
