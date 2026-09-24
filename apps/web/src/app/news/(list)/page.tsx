import { CacheTags, ScopeFilter } from '@church/shared';
import { Container } from '@church/ui/container';
import { EmptyState } from '@church/ui/empty-state';
import { Newspaper } from 'lucide-react';
import type { Metadata } from 'next';
import { ContextBar } from '@/components/content/context-bar';
import { LoadMore } from '@/components/content/load-more';
import { NewsCard } from '@/components/content/news-card';
import { PageHeader } from '@/components/content/page-header';
import { publicApi, unwrap } from '@/lib/api/server';
import { branchParam, param } from '@/lib/context';
import { getBranches } from '@/lib/data';

export const metadata: Metadata = {
  title: 'News',
  description: 'Stories and news from across the church and its branches.',
  alternates: { canonical: '/news' },
};

const PAGE_SIZE = 13;

export default async function NewsPage({ searchParams }: PageProps<'/news'>) {
  const params = await searchParams;
  const requestedBranch = branchParam(params);
  const scope = ScopeFilter.safeParse(param(params, 'scope')).data ?? 'all';
  const [branches, { client, fetch }] = await Promise.all([getBranches(), publicApi({ tags: [CacheTags.content] })]);
  // Unknown branches are ignored rather than 404ing a listing page.
  const branch = branches.find((b) => b.slug === requestedBranch) ?? null;
  const branchSlug = branch?.slug;
  const query = { branch: branchSlug, scope, types: 'news', limit: PAGE_SIZE };
  const page = unwrap(await client.GET('/api/v1/content', { params: { query }, fetch }));
  const [lead, ...rest] = page.items;

  return (
    <>
      <PageHeader eyebrow={branch ? branch.name : 'Whole church'} title="News" description="Stories from across the church and its branches.">
        <ContextBar path="/news" branch={branch} scope={scope} />
      </PageHeader>
      <Container className="flex flex-col gap-8 py-8">
        {!lead ? (
          <EmptyState icon={<Newspaper />} title="No news yet" description="Stories and news will appear here as soon as they are published." />
        ) : (
          <>
            <NewsCard item={lead} lead headingLevel={2} />
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((item) => (
                <li key={item.id}>
                  <NewsCard item={item} headingLevel={2} />
                </li>
              ))}
              <LoadMore
                endpoint="/api/v1/content"
                variant="news"
                grid
                initialCursor={page.nextCursor}
                query={{ branch: branchSlug, scope, types: 'news', limit: '12' }}
              />
            </ul>
          </>
        )}
      </Container>
    </>
  );
}
