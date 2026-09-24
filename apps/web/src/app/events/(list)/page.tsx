import { CacheTags, EVENT_CATEGORY_LABEL, EventCategory, ScopeFilter } from '@church/shared';
import { Container } from '@church/ui/container';
import { EmptyState } from '@church/ui/empty-state';
import { chipClass, segmentClass, SegmentedNav } from '@church/ui/segmented';
import { CalendarDays } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ContextBar } from '@/components/content/context-bar';
import { EventTimeline } from '@/components/content/event-timeline';
import { PageHeader } from '@/components/content/page-header';
import { publicApi, unwrap } from '@/lib/api/server';
import { branchParam, href, param } from '@/lib/context';
import { getBranches } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Events',
  description: 'Services, conferences, baptisms and gatherings across the church.',
  alternates: { canonical: '/events' },
};

const PAGE_SIZE = 20;

export default async function EventsPage({ searchParams }: PageProps<'/events'>) {
  const params = await searchParams;
  const requestedBranch = branchParam(params);
  const scope = ScopeFilter.safeParse(param(params, 'scope')).data ?? 'all';
  const when = param(params, 'when') === 'past' ? 'past' : 'upcoming';
  const category = EventCategory.schema.safeParse(param(params, 'category')?.toUpperCase()).data;

  const [branches, { client, fetch }] = await Promise.all([
    getBranches(),
    publicApi({ tags: [CacheTags.content] }),
  ]);
  // Unknown branches are ignored rather than 404ing a listing page.
  const branch = branches.find((b) => b.slug === requestedBranch) ?? null;
  const branchSlug = branch?.slug;
  const query = { branch: branchSlug, scope, when, category, limit: PAGE_SIZE } as const;
  const page = unwrap(await client.GET('/api/v1/events', { params: { query }, fetch }));

  const keep = { when: when === 'past' ? 'past' : undefined, category: category?.toLowerCase() };
  const link = (next: Partial<typeof keep>) =>
    href('/events', {
      branch: branchSlug,
      scope: scope === 'all' ? undefined : scope,
      ...keep,
      ...next,
    });
  const filtered = Boolean(category) || scope !== 'all';

  return (
    <>
      <PageHeader
        eyebrow={branch ? branch.name : 'Whole church'}
        title="Events"
        description="Services, conferences, baptisms and gatherings."
      >
        <ContextBar path="/events" branch={branch} scope={scope} keep={keep} />
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <SegmentedNav label="Upcoming or past events">
            <li>
              <Link
                href={link({ when: undefined })}
                aria-current={when === 'upcoming' ? 'page' : undefined}
                className={segmentClass(when === 'upcoming')}
              >
                Upcoming
              </Link>
            </li>
            <li>
              <Link
                href={link({ when: 'past' })}
                aria-current={when === 'past' ? 'page' : undefined}
                className={segmentClass(when === 'past')}
              >
                Past
              </Link>
            </li>
          </SegmentedNav>
          <nav
            aria-label="Filter by kind of event"
            className="relative -mx-4 scrollbar-none overflow-x-auto px-4 md:mx-0 md:px-0"
          >
            <ul className="flex gap-2">
              <li>
                <Link
                  href={link({ category: undefined })}
                  aria-current={!category ? 'page' : undefined}
                  className={chipClass(!category)}
                >
                  All kinds
                </Link>
              </li>
              {EventCategory.values.map((c) => (
                <li key={c}>
                  <Link
                    href={link({ category: c.toLowerCase() })}
                    aria-current={category === c ? 'page' : undefined}
                    className={chipClass(category === c)}
                  >
                    {c === 'OTHER' ? 'Other' : EVENT_CATEGORY_LABEL[c]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </PageHeader>
      <Container className="py-8">
        <div className="mx-auto max-w-3xl">
          {page.items.length === 0 ? (
            <EmptyState
              icon={<CalendarDays />}
              title={when === 'upcoming' ? 'No upcoming events' : 'No past events'}
              description={
                filtered
                  ? 'Nothing matches these filters. Try showing every kind of event.'
                  : when === 'upcoming'
                    ? 'New services and gatherings will be listed here as soon as they are planned.'
                    : 'Events will appear here once they have taken place.'
              }
              action={
                filtered ? (
                  <Link
                    href={href('/events', { branch: branchSlug, when: keep.when })}
                    className="text-sm font-medium text-link underline"
                  >
                    Show all events
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <EventTimeline
              initialItems={page.items}
              initialCursor={page.nextCursor}
              query={{ branch: branchSlug, scope, when, category, limit: String(PAGE_SIZE) }}
            />
          )}
        </div>
      </Container>
    </>
  );
}
