import { BRANCH_TYPE_LABEL, CacheTags, type BranchDetail } from '@church/shared';
import { Alert } from '@church/ui/alert';
import { Avatar } from '@church/ui/avatar';
import { Badge } from '@church/ui/badge';
import { buttonVariants } from '@church/ui/button';
import { Card } from '@church/ui/card';
import { Container } from '@church/ui/container';
import { EmptyState } from '@church/ui/empty-state';
import { ArrowLeft, ArrowRight, CalendarDays, Clock, Mail, MapPin, Navigation, Phone } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';
import { ContentCard } from '@/components/content/content-card';
import { EventList } from '@/components/content/event-list';
import { JsonLd } from '@/components/content/json-ld';
import { Markdown } from '@/components/content/markdown';
import { Picture } from '@/components/content/picture';
import { SectionHeading } from '@/components/content/section-heading';
import { ServiceTimes } from '@/components/content/service-times';
import { publicApi, unwrap } from '@/lib/api/server';
import { resolveLegacyPath } from '@/lib/content';
import { withBranch } from '@/lib/context';
import { getOrganization } from '@/lib/data';
import { serverEnv } from '@/lib/env';
import { directionsUrl } from '@/lib/maps';

const LOOKUP = /^[a-z0-9][a-z0-9-]{0,199}$/;

const getBranch = cache(async (slug: string): Promise<BranchDetail | null> => {
  const { client, fetch } = await publicApi({ tags: [CacheTags.branches, CacheTags.branch(slug)] });
  const result = await client.GET('/api/v1/branches/{slug}', { params: { path: { slug } }, fetch });
  if (result.response.status === 404) return null;
  return unwrap(result);
});

/** The branch for this URL; legacy ids (the old app used UUIDs) redirect to the slug URL. */
async function loadBranch(rawSlug: string): Promise<BranchDetail> {
  const slug = decodeURIComponent(rawSlug).toLowerCase();
  if (!LOOKUP.test(slug)) notFound();
  const branch = await getBranch(slug);
  if (!branch) {
    const legacy = await resolveLegacyPath('branch', slug);
    if (legacy) permanentRedirect(legacy);
    notFound();
  }
  if (slug !== rawSlug) permanentRedirect(`/branches/${branch.slug}`);
  return branch;
}

export async function generateMetadata({ params }: PageProps<'/branches/[slug]'>): Promise<Metadata> {
  const branch = await loadBranch((await params).slug);
  const place = [branch.city, branch.province].filter(Boolean).join(', ');
  return {
    title: `${branch.name} branch`,
    description: `Service times, leaders and directions for the ${branch.name} branch${place ? ` in ${place}` : ''}.`,
    alternates: { canonical: `/branches/${branch.slug}` },
    openGraph: { images: branch.cover ? [{ url: branch.cover.url }] : undefined },
  };
}

function branchJsonLd(branch: BranchDetail, organizationName: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Church',
    name: `${organizationName}, ${branch.name}`,
    url: new URL(`/branches/${branch.slug}`, serverEnv.appOrigin).toString(),
    telephone: branch.phone ?? undefined,
    email: branch.email ?? undefined,
    address: branch.addressLine1
      ? {
          '@type': 'PostalAddress',
          streetAddress: [branch.addressLine1, branch.addressLine2].filter(Boolean).join(', '),
          addressLocality: branch.city ?? undefined,
          addressRegion: branch.province ?? undefined,
          postalCode: branch.postalCode ?? undefined,
          addressCountry: branch.countryCode,
        }
      : undefined,
    geo:
      branch.latitude !== null && branch.longitude !== null
        ? { '@type': 'GeoCoordinates', latitude: branch.latitude, longitude: branch.longitude }
        : undefined,
  };
}

export default async function BranchPage({ params }: PageProps<'/branches/[slug]'>) {
  const branch = await loadBranch((await params).slug);
  const { client, fetch } = await publicApi({ tags: [CacheTags.content] });
  const branchQuery = { branch: branch.slug, scope: 'branch' as const };
  const [organization, latest, events] = await Promise.all([
    getOrganization(),
    // Events have their own list beside this one.
    client.GET('/api/v1/content', { params: { query: { ...branchQuery, types: 'announcement,post,news,sermon,baptism', limit: 4 } }, fetch }).then(unwrap),
    client.GET('/api/v1/events', { params: { query: { ...branchQuery, when: 'upcoming', limit: 4 } }, fetch }).then(unwrap),
  ]);
  const address = [branch.addressLine1, branch.addressLine2, branch.city, branch.province, branch.postalCode].filter(
    (part): part is string => Boolean(part),
  );
  const directions = directionsUrl({ mapsUrl: branch.mapsUrl, latitude: branch.latitude, longitude: branch.longitude, address });

  return (
    <>
      <JsonLd data={branchJsonLd(branch, organization.name)} />
      <header className="border-b border-border bg-surface">
        <Container className="flex flex-col gap-4 py-8 sm:py-10">
          <Link href="/branches" className="inline-flex items-center gap-1 self-start text-sm font-medium text-link hover:underline">
            <ArrowLeft aria-hidden="true" className="size-4" /> All branches
          </Link>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {branch.type !== 'MAIN' ? <Badge tone="neutral">{BRANCH_TYPE_LABEL[branch.type]}</Badge> : null}
                {branch.parent ? (
                  <span className="text-sm text-muted">
                    Part of{' '}
                    <Link href={`/branches/${branch.parent.slug}`} className="font-medium text-link hover:underline">
                      {branch.parent.name}
                    </Link>
                  </span>
                ) : null}
              </div>
              <h1 className="text-3xl font-semibold sm:text-5xl">{branch.name}</h1>
              {branch.city || branch.province ? (
                <p className="flex items-center gap-1.5 text-lg text-muted">
                  <MapPin aria-hidden="true" className="size-5" />
                  {[branch.city, branch.province].filter(Boolean).join(', ')}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={withBranch('/', branch.slug)} className={buttonVariants({ variant: 'primary' })}>
                See {branch.name} news <ArrowRight aria-hidden="true" />
              </Link>
              {directions ? (
                <a href={directions} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'secondary' })}>
                  <Navigation aria-hidden="true" /> Directions
                </a>
              ) : null}
            </div>
          </div>
        </Container>
      </header>

      <Container className="py-8 sm:py-10">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
          <div className="flex min-w-0 flex-col gap-10">
            {branch.temporaryChanges.length > 0 ? (
              <Alert tone="warning" title="Changes to the usual times">
                <ServiceTimes schedules={branch.temporaryChanges} compact />
              </Alert>
            ) : null}

            <section aria-labelledby="times-heading" className="flex flex-col gap-3">
              <SectionHeading id="times-heading" icon={<Clock />}>
                Service times
              </SectionHeading>
              <ServiceTimes schedules={branch.schedules} emptyText="Service times have not been listed yet. Please contact the branch." />
            </section>

            {branch.description ? (
              <section aria-labelledby="about-heading" className="flex flex-col gap-3">
                <SectionHeading id="about-heading">About this branch</SectionHeading>
                <Markdown>{branch.description}</Markdown>
              </section>
            ) : null}

            {branch.leaders.length > 0 ? (
              <section aria-labelledby="leaders-heading" className="flex flex-col gap-4">
                <SectionHeading id="leaders-heading">Leadership</SectionHeading>
                <ul className="grid gap-4 sm:grid-cols-2">
                  {branch.leaders.map((leader) => (
                    <li key={leader.id} className="flex gap-3 rounded-xl border border-border bg-surface p-4">
                      <Avatar name={leader.name} src={leader.photo?.url} size="lg" />
                      <div className="flex min-w-0 flex-col">
                        <p className="font-semibold">{leader.name}</p>
                        <p className="text-sm text-muted">{leader.title}</p>
                        {leader.bio ? <p className="mt-1 line-clamp-3 text-sm text-muted">{leader.bio}</p> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section aria-labelledby="branch-latest-heading" className="flex flex-col gap-4">
              <SectionHeading id="branch-latest-heading" action={{ href: withBranch('/feed', branch.slug, { scope: 'branch' }), label: 'All updates' }}>
                Latest from {branch.name}
              </SectionHeading>
              {latest.items.length > 0 ? (
                <ul className="flex flex-col gap-4">
                  {latest.items.map((item) => (
                    <li key={item.id}>
                      <ContentCard item={item} />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState size="sm" title="Nothing shared yet" description={`Updates from ${branch.name} will appear here.`} />
              )}
            </section>

            {branch.gallery.length > 0 ? (
              <section aria-labelledby="gallery-heading" className="flex flex-col gap-4">
                <SectionHeading id="gallery-heading">Photos</SectionHeading>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {branch.gallery.map((image) => (
                    <li key={image.id}>
                      <figure className="flex flex-col gap-1">
                        <Picture image={image} sizes="(min-width: 640px) 33vw, 50vw" className="aspect-square w-full rounded-lg" />
                        {image.caption ? <figcaption className="text-xs text-muted">{image.caption}</figcaption> : null}
                      </figure>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start" aria-label="Contact and events">
            <Card className="flex flex-col gap-4 p-5">
              <h2 className="text-lg font-semibold">Visit and contact</h2>
              <dl className="flex flex-col gap-3 text-sm">
                {address.length > 0 ? (
                  <div className="flex gap-3">
                    <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted" />
                    <div>
                      <dt className="sr-only">Address</dt>
                      <dd>
                        <address className="not-italic">
                          {address.map((line) => (
                            <span key={line} className="block">
                              {line}
                            </span>
                          ))}
                        </address>
                      </dd>
                    </div>
                  </div>
                ) : null}
                {branch.phone ? (
                  <div className="flex gap-3">
                    <Phone aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted" />
                    <div>
                      <dt className="sr-only">Phone</dt>
                      <dd>
                        <a href={`tel:${branch.phone.replace(/\s+/g, '')}`} className="font-medium text-link hover:underline">
                          {branch.phone}
                        </a>
                      </dd>
                    </div>
                  </div>
                ) : null}
                {branch.email ? (
                  <div className="flex gap-3">
                    <Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted" />
                    <div>
                      <dt className="sr-only">E-mail</dt>
                      <dd>
                        <a href={`mailto:${branch.email}`} className="font-medium break-all text-link hover:underline">
                          {branch.email}
                        </a>
                      </dd>
                    </div>
                  </div>
                ) : null}
              </dl>
              {address.length === 0 && !branch.phone && !branch.email ? (
                <p className="text-sm text-muted">Contact details have not been added yet.</p>
              ) : null}
              {directions ? (
                <a href={directions} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                  <Navigation aria-hidden="true" /> Open in maps
                </a>
              ) : null}
            </Card>

            <section aria-labelledby="branch-events-heading" className="flex flex-col gap-3">
              <SectionHeading id="branch-events-heading" icon={<CalendarDays />} action={{ href: withBranch('/events', branch.slug), label: 'All' }}>
                Coming up
              </SectionHeading>
              {events.items.length > 0 ? (
                <Card className="p-4">
                  <EventList items={events.items} />
                </Card>
              ) : (
                <p className="text-sm text-muted">No events planned at this branch yet.</p>
              )}
            </section>

            {branch.subBranches.length > 0 ? (
              <Card className="flex flex-col gap-3 p-5">
                <h2 className="text-lg font-semibold">Also part of {branch.name}</h2>
                <ul className="flex flex-col gap-1">
                  {branch.subBranches.map((sub) => (
                    <li key={sub.id}>
                      <Link href={`/branches/${sub.slug}`} className="text-sm font-medium text-link hover:underline">
                        {sub.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </aside>
        </div>
      </Container>
    </>
  );
}
