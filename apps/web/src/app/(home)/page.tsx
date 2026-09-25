import { type BaptismSummary, CacheTags, type HomeResponse } from '@church/shared';
import { buttonVariants } from '@church/ui/button';
import { Card } from '@church/ui/card';
import { Container } from '@church/ui/container';
import { EmptyState } from '@church/ui/empty-state';
import { chipClass } from '@church/ui/segmented';
import { ArrowRight, CalendarDays, Church, Clock, Globe, Inbox, MapPin, Pin } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ScopeBadge } from '@/components/content/badges';
import { BaptismStat } from '@/components/content/baptism-stat';
import { ContentCard } from '@/components/content/content-card';
import { Countdown } from '@/components/content/countdown';
import { DateTile } from '@/components/content/date-tile';
import { EventList } from '@/components/content/event-list';
import { NewsCard } from '@/components/content/news-card';
import { SectionHeading } from '@/components/content/section-heading';
import { SermonCard } from '@/components/content/sermon-card';
import { ServiceTimes } from '@/components/content/service-times';
import { publicApi, unwrap } from '@/lib/api/server';
import { branchParam, type SearchParams, withBranch } from '@/lib/context';
import { getBranches, getOrganization } from '@/lib/data';
import { formatEventTiming, formatLongDate } from '@/lib/format';

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const branch = branchParam(await searchParams);
  const organization = await getOrganization();
  if (!branch) return { alternates: { canonical: '/' } };
  const name = (await getBranches()).find((b) => b.slug === branch)?.name ?? 'Branch';
  return {
    title: `${name} branch`,
    description: `What’s happening at the ${name} branch of ${organization.name}.`,
    alternates: { canonical: withBranch('/', branch) },
  };
}

async function loadHome(branch: string | undefined): Promise<HomeResponse> {
  const { client, fetch } = await publicApi({ tags: [CacheTags.content, CacheTags.branches] });
  return unwrap(await client.GET('/api/v1/home', { params: { query: { branch } }, fetch }));
}

/** Baptism totals for the whole church. Never fails the page: the stat is hidden instead. */
async function loadBaptisms(): Promise<BaptismSummary | null> {
  try {
    const { client, fetch } = await publicApi({ tags: [CacheTags.branches] });
    const result = await client.GET('/api/v1/geography/baptisms', { fetch });
    return result.data ?? null;
  } catch {
    return null;
  }
}

export default async function HomePage({ searchParams }: PageProps) {
  const requestedBranch = branchParam(await searchParams);
  // The layout loads these too (deduplicated); unknown branches fall back to the whole church.
  const [organization, branches] = await Promise.all([getOrganization(), getBranches()]);
  const branchSlug = branches.find((b) => b.slug === requestedBranch)?.slug;
  const [home, baptisms] = await Promise.all([loadHome(branchSlug), loadBaptisms()]);
  const branch = home.branch;
  const now = new Date();

  return (
    <>
      {/* Context: where you are, and one tap to switch (the legacy Global / branch tabs). */}
      <section aria-labelledby="welcome-heading" className="border-b border-border bg-surface">
        <Container className="flex flex-col gap-6 py-8 sm:py-12">
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-sm font-medium text-accent-strong">
              {branch ? (
                <MapPin aria-hidden="true" className="size-4" />
              ) : (
                <Globe aria-hidden="true" className="size-4" />
              )}
              {branch
                ? `${[branch.city, branch.province].filter(Boolean).join(', ') || 'Branch'}`
                : 'The whole church'}
            </p>
            <h1 id="welcome-heading" className="text-3xl font-semibold sm:text-5xl">
              {branch ? branch.name : (organization.shortName ?? organization.name)}
            </h1>
            <p className="max-w-2xl text-base text-muted sm:text-lg">
              {branch
                ? `News, events and services at the ${branch.name} branch, together with church-wide updates.`
                : (organization.tagline ??
                  `News, events and sermons from every branch of ${organization.name}.`)}
            </p>
          </div>
          <nav
            aria-label="Choose a branch"
            className="relative -mx-4 scrollbar-none overflow-x-auto px-4 sm:mx-0 sm:px-0"
          >
            <ul className="flex gap-2">
              <li>
                <Link
                  href="/"
                  aria-current={!branch ? 'page' : undefined}
                  className={chipClass(!branch)}
                >
                  <Globe aria-hidden="true" /> Global
                </Link>
              </li>
              {branches.map((b) => (
                <li key={b.slug}>
                  <Link
                    href={withBranch('/', b.slug)}
                    aria-current={branch?.slug === b.slug ? 'page' : undefined}
                    className={chipClass(branch?.slug === b.slug)}
                  >
                    {b.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {branch ? (
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Clock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted" />
                <ServiceTimes
                  schedules={branch.services}
                  compact
                  emptyText="Service times are not listed yet."
                />
              </div>
              <Link
                href={`/branches/${branch.slug}`}
                className={buttonVariants({ variant: 'secondary', size: 'sm' })}
              >
                Branch details <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          ) : null}
        </Container>
      </section>

      {/* The number the church cares about most, straight after the welcome. */}
      {baptisms ? <BaptismStat summary={baptisms} /> : null}

      <Container className="flex flex-col gap-12 py-10">
        {home.featuredEvent?.event ? (
          <section aria-labelledby="featured-heading">
            <Card className="relative flex flex-col gap-6 overflow-hidden p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
              <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-accent" />
              <div className="flex gap-4">
                <DateTile
                  iso={home.featuredEvent.event.startsAt}
                  timeZone={home.featuredEvent.event.timezone}
                  className="hidden self-start sm:flex"
                />
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium text-accent-strong">Coming up</p>
                  <h2 id="featured-heading" className="text-2xl font-semibold sm:text-3xl">
                    <Link href={home.featuredEvent.path} className="hover:underline">
                      {home.featuredEvent.title}
                    </Link>
                  </h2>
                  <p className="flex items-center gap-2 text-sm text-muted">
                    <CalendarDays aria-hidden="true" className="size-4" />
                    {formatEventTiming(home.featuredEvent.event, home.featuredEvent.event.timezone)}
                  </p>
                  {home.featuredEvent.event.venueName ? (
                    <p className="flex items-center gap-2 text-sm text-muted">
                      <MapPin aria-hidden="true" className="size-4" />
                      {home.featuredEvent.event.venueName}
                    </p>
                  ) : null}
                  <div>
                    <ScopeBadge
                      scope={home.featuredEvent.scope}
                      branch={home.featuredEvent.branch}
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-4 lg:items-end">
                <Countdown
                  startsAt={home.featuredEvent.event.startsAt}
                  label={`Starts ${formatLongDate(home.featuredEvent.event.startsAt, home.featuredEvent.event.timezone)}`}
                />
                <Link
                  href={home.featuredEvent.path}
                  className={buttonVariants({ variant: 'primary' })}
                >
                  Event details <ArrowRight aria-hidden="true" />
                </Link>
              </div>
            </Card>
          </section>
        ) : null}

        {home.pinned.length > 0 ? (
          <section aria-labelledby="pinned-heading" className="flex flex-col gap-4">
            <SectionHeading id="pinned-heading" icon={<Pin />}>
              Important
            </SectionHeading>
            <ul className="grid gap-4 md:grid-cols-2">
              {home.pinned.map((item) => (
                <li key={item.id}>
                  <ContentCard item={item} now={now} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="grid gap-12 lg:grid-cols-3 lg:gap-10">
          <section aria-labelledby="latest-heading" className="flex flex-col gap-4 lg:col-span-2">
            <SectionHeading
              id="latest-heading"
              action={{ href: withBranch('/feed', branchSlug), label: 'See all updates' }}
            >
              Latest updates
            </SectionHeading>
            {home.latest.length > 0 ? (
              <ul className="flex flex-col gap-4">
                {home.latest.map((item) => (
                  <li key={item.id}>
                    <ContentCard item={item} now={now} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Inbox />}
                title="The feed is quiet for now"
                description={
                  branch
                    ? `There are no recent updates from ${branch.name} yet. Church-wide news will appear here too.`
                    : 'New announcements and updates from every branch will appear here.'
                }
              />
            )}
          </section>

          <aside className="flex flex-col gap-10" aria-label="Upcoming and recent">
            <section aria-labelledby="soon-heading" className="flex flex-col gap-4">
              <SectionHeading
                id="soon-heading"
                action={{ href: withBranch('/events', branchSlug), label: 'All events' }}
              >
                Happening soon
              </SectionHeading>
              {home.upcomingEvents.length > 0 ? (
                <Card className="p-4">
                  <EventList items={home.upcomingEvents} />
                </Card>
              ) : (
                <EmptyState
                  size="sm"
                  icon={<CalendarDays />}
                  title="No upcoming events"
                  description="Check back soon."
                />
              )}
            </section>

            <section aria-labelledby="sermon-heading" className="flex flex-col gap-4">
              <SectionHeading
                id="sermon-heading"
                action={{ href: withBranch('/sermons', branchSlug), label: 'Sermon library' }}
              >
                Latest sermon
              </SectionHeading>
              {home.latestSermon ? (
                <SermonCard item={home.latestSermon} />
              ) : (
                <EmptyState
                  size="sm"
                  title="No sermons yet"
                  description="Recorded sermons will appear here."
                />
              )}
            </section>

            {!branch ? (
              <Card className="flex flex-col gap-3 p-5">
                <div className="flex items-center gap-2">
                  <Church aria-hidden="true" className="size-5 text-accent-strong" />
                  <h2 className="text-lg font-semibold">Find your branch</h2>
                </div>
                <p className="text-sm text-muted">
                  Service times, leadership and directions for every branch.
                </p>
                <Link
                  href="/branches"
                  className={buttonVariants({
                    variant: 'secondary',
                    size: 'sm',
                    className: 'self-start',
                  })}
                >
                  Browse branches <ArrowRight aria-hidden="true" />
                </Link>
              </Card>
            ) : null}
          </aside>
        </div>

        {home.news.length > 0 ? (
          <section aria-labelledby="news-heading" className="flex flex-col gap-4">
            <SectionHeading
              id="news-heading"
              action={{ href: withBranch('/news', branchSlug), label: 'All news' }}
            >
              News
            </SectionHeading>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {home.news.map((item) => (
                <li key={item.id}>
                  <NewsCard item={item} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </Container>
    </>
  );
}
