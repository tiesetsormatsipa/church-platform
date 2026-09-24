import { CacheTags, CONTENT_TYPE_LABEL, ContentType, ScopeFilter } from '@church/shared';
import { Container } from '@church/ui/container';
import { EmptyState } from '@church/ui/empty-state';
import { chipClass } from '@church/ui/segmented';
import { Inbox } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentCard } from '@/components/content/content-card';
import { ContextBar } from '@/components/content/context-bar';
import { LoadMore } from '@/components/content/load-more';
import { PageHeader } from '@/components/content/page-header';
import { publicApi, unwrap } from '@/lib/api/server';
import { branchParam, href, param, type SearchParams } from '@/lib/context';
import { getBranches } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Feed',
  description: 'Announcements, news, events, sermons and baptisms from across the church, newest first.',
  alternates: { canonical: '/feed' },
};

const PAGE_SIZE = 12;

export default async function FeedPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const branchSlug = branchParam(params);
  const scope = ScopeFilter.safeParse(param(params, 'scope')).data ?? 'all';
  const typeParam = param(params, 'types')?.toUpperCase();
  const type = ContentType.schema.safeParse(typeParam).data;

  const [branches, { client, fetch }] = await Promise.all([getBranches(), publicApi({ tags: [CacheTags.content] })]);
  const branch = branches.find((b) => b.slug === branchSlug) ?? null;
  const query = { branch: branchSlug, scope, types: type?.toLowerCase(), limit: PAGE_SIZE };
  const page = unwrap(await client.GET('/api/v1/content', { params: { query }, fetch }));
  const now = new Date();

  const typeLink = (value: string | undefined) =>
    href('/feed', { branch: branchSlug, scope: scope === 'all' ? undefined : scope, types: value });

  return (
    <>
      <PageHeader
        eyebrow={branch ? branch.name : 'Whole church'}
        title="Feed"
        description="Everything that’s been shared, newest first."
      >
        <ContextBar path="/feed" branch={branch} scope={scope} keep={{ types: type?.toLowerCase() }} />
        <nav aria-label="Filter by type" className="-mx-4 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
          <ul className="flex gap-2">
            <li>
              <Link href={typeLink(undefined)} aria-current={!type ? 'page' : undefined} className={chipClass(!type)}>
                All
              </Link>
            </li>
            {ContentType.values.map((t) => (
              <li key={t}>
                <Link href={typeLink(t.toLowerCase())} aria-current={type === t ? 'page' : undefined} className={chipClass(type === t)}>
                  {CONTENT_TYPE_LABEL[t].plural}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </PageHeader>
      <Container className="py-8">
        <div className="mx-auto max-w-3xl">
          {page.items.length === 0 ? (
            <EmptyState
              icon={<Inbox />}
              title="The feed is quiet for now"
              description={
                type || scope !== 'all'
                  ? 'Nothing matches these filters yet. Try showing everything.'
                  : 'New announcements, news and events will appear here as soon as they are shared.'
              }
              action={
                type || scope !== 'all' ? (
                  <Link href={href('/feed', { branch: branchSlug })} className="text-sm font-medium text-link underline">
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
                query={{ branch: branchSlug, scope, types: type?.toLowerCase(), limit: String(PAGE_SIZE) }}
              />
            </ul>
          )}
        </div>
      </Container>
    </>
  );
}
