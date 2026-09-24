import { CacheTags, CONTENT_TYPE_LABEL, ContentType, ScopeFilter, Slug } from '@church/shared';
import { Container } from '@church/ui/container';
import { EmptyState } from '@church/ui/empty-state';
import { chipClass } from '@church/ui/segmented';
import { Inbox, X } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentCard } from '@/components/content/content-card';
import { ContextBar } from '@/components/content/context-bar';
import { LoadMore } from '@/components/content/load-more';
import { PageHeader } from '@/components/content/page-header';
import { publicApi, unwrap } from '@/lib/api/server';
import { branchParam, href, param } from '@/lib/context';
import { getBranches } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Feed',
  description:
    'Announcements, news, events, sermons and baptisms from across the church, newest first.',
  alternates: { canonical: '/feed' },
};

const PAGE_SIZE = 12;

export default async function FeedPage({ searchParams }: PageProps<'/feed'>) {
  const params = await searchParams;
  const requestedBranch = branchParam(params);
  const scope = ScopeFilter.safeParse(param(params, 'scope')).data ?? 'all';
  const typeParam = param(params, 'types')?.toUpperCase();
  const type = ContentType.schema.safeParse(typeParam).data;
  const tag = Slug.safeParse(param(params, 'tag')).data;

  const [branches, { client, fetch }] = await Promise.all([
    getBranches(),
    publicApi({ tags: [CacheTags.content] }),
  ]);
  // Unknown branches are ignored rather than 404ing a listing page.
  const branch = branches.find((b) => b.slug === requestedBranch) ?? null;
  const branchSlug = branch?.slug;
  const query = { branch: branchSlug, scope, types: type?.toLowerCase(), tag, limit: PAGE_SIZE };
  const page = unwrap(await client.GET('/api/v1/content', { params: { query }, fetch }));
  const now = new Date();

  const typeLink = (value: string | undefined) =>
    href('/feed', {
      branch: branchSlug,
      scope: scope === 'all' ? undefined : scope,
      types: value,
      tag,
    });
  const filtered = Boolean(type || tag) || scope !== 'all';

  return (
    <>
      <PageHeader
        eyebrow={branch ? branch.name : 'Whole church'}
        title="Feed"
        description="Everything that’s been shared, newest first."
      >
        <ContextBar
          path="/feed"
          branch={branch}
          scope={scope}
          keep={{ types: type?.toLowerCase(), tag }}
        />
        <nav
          aria-label="Filter by type"
          className="relative -mx-4 scrollbar-none overflow-x-auto px-4 sm:mx-0 sm:px-0"
        >
          <ul className="flex gap-2">
            <li>
              <Link
                href={typeLink(undefined)}
                aria-current={!type ? 'page' : undefined}
                className={chipClass(!type)}
              >
                All
              </Link>
            </li>
            {ContentType.values.map((t) => (
              <li key={t}>
                <Link
                  href={typeLink(t.toLowerCase())}
                  aria-current={type === t ? 'page' : undefined}
                  className={chipClass(type === t)}
                >
                  {CONTENT_TYPE_LABEL[t].plural}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {tag ? (
          <p className="flex items-center gap-2 text-sm">
            <span className="rounded-full bg-primary-soft px-3 py-1 font-medium text-primary-soft-foreground">
              #{tag}
            </span>
            <Link
              href={href('/feed', { branch: branchSlug, types: type?.toLowerCase() })}
              className="inline-flex items-center gap-1 font-medium text-link hover:underline"
            >
              <X aria-hidden="true" className="size-4" /> Clear topic
            </Link>
          </p>
        ) : null}
      </PageHeader>
      <Container className="py-8">
        <div className="mx-auto max-w-3xl">
          {page.items.length === 0 ? (
            <EmptyState
              icon={<Inbox />}
              title="The feed is quiet for now"
              description={
                filtered
                  ? 'Nothing matches these filters yet. Try showing everything.'
                  : 'New announcements, news and events will appear here as soon as they are shared.'
              }
              action={
                filtered ? (
                  <Link
                    href={href('/feed', { branch: branchSlug })}
                    className="text-sm font-medium text-link underline"
                  >
                    Show everything
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {page.items.map((item) => (
                <li key={item.id}>
                  <ContentCard item={item} now={now} headingLevel={2} />
                </li>
              ))}
              <LoadMore
                endpoint="/api/v1/content"
                initialCursor={page.nextCursor}
                query={{
                  branch: branchSlug,
                  scope,
                  types: type?.toLowerCase(),
                  tag,
                  limit: String(PAGE_SIZE),
                }}
              />
            </ul>
          )}
        </div>
      </Container>
    </>
  );
}
