import { CacheTags, ScopeFilter, Slug } from '@church/shared';
import { Button } from '@church/ui/button';
import { Container } from '@church/ui/container';
import { EmptyState } from '@church/ui/empty-state';
import { Input, NativeSelect } from '@church/ui/input';
import { Headphones, Search, X } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ContextBar } from '@/components/content/context-bar';
import { LoadMore } from '@/components/content/load-more';
import { PageHeader } from '@/components/content/page-header';
import { SermonCard } from '@/components/content/sermon-card';
import { publicApi, unwrap } from '@/lib/api/server';
import { branchParam, href, param } from '@/lib/context';
import { getBranches } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Sermons',
  description: 'Listen to and watch recent sermons, by speaker, series or topic.',
  alternates: { canonical: '/sermons' },
};

const PAGE_SIZE = 12;

export default async function SermonsPage({ searchParams }: PageProps<'/sermons'>) {
  const params = await searchParams;
  const requestedBranch = branchParam(params);
  const scope = ScopeFilter.safeParse(param(params, 'scope')).data ?? 'all';
  const speaker = Slug.safeParse(param(params, 'speaker')).data;
  const series = Slug.safeParse(param(params, 'series')).data;
  const tag = Slug.safeParse(param(params, 'tag')).data;
  const q = param(params, 'q')?.trim().slice(0, 100) || undefined;

  const [branches, { client, fetch }] = await Promise.all([
    getBranches(),
    publicApi({ tags: [CacheTags.content] }),
  ]);
  // Unknown branches are ignored rather than 404ing a listing page.
  const branch = branches.find((b) => b.slug === requestedBranch) ?? null;
  const branchSlug = branch?.slug;
  const query = { branch: branchSlug, scope, speaker, series, tag, q, limit: PAGE_SIZE };
  const [page, facets] = await Promise.all([
    client.GET('/api/v1/sermons', { params: { query }, fetch }).then(unwrap),
    client.GET('/api/v1/sermons/facets', { fetch }).then(unwrap),
  ]);

  const filters = [
    speaker && {
      label: `Speaker: ${facets.speakers.find((s) => s.slug === speaker)?.name ?? speaker}`,
    },
    series && { label: `Series: ${facets.series.find((s) => s.slug === series)?.title ?? series}` },
    tag && { label: `Topic: ${facets.tags.find((t) => t.slug === tag)?.name ?? tag}` },
    q && { label: `“${q}”` },
  ].filter((f): f is { label: string } => Boolean(f));
  const clearHref = href('/sermons', {
    branch: branchSlug,
    scope: scope === 'all' ? undefined : scope,
  });

  return (
    <>
      <PageHeader
        eyebrow={branch ? branch.name : 'Whole church'}
        title="Sermons"
        description="Listen again, or catch up on a message you missed."
      >
        <ContextBar
          path="/sermons"
          branch={branch}
          scope={scope}
          keep={{ speaker, series, tag, q }}
        />
        <form
          method="get"
          action="/sermons"
          role="search"
          aria-label="Find sermons"
          className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
        >
          {branchSlug ? <input type="hidden" name="branch" value={branchSlug} /> : null}
          {scope !== 'all' ? <input type="hidden" name="scope" value={scope} /> : null}
          {tag ? <input type="hidden" name="tag" value={tag} /> : null}
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
            />
            <Input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Title, scripture or topic"
              aria-label="Search sermons"
              className="pl-9"
            />
          </div>
          <NativeSelect name="speaker" defaultValue={speaker ?? ''} aria-label="Speaker">
            <option value="">All speakers</option>
            {facets.speakers.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name} ({s.sermonCount})
              </option>
            ))}
          </NativeSelect>
          <NativeSelect name="series" defaultValue={series ?? ''} aria-label="Series">
            <option value="">All series</option>
            {facets.series.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.title} ({s.sermonCount})
              </option>
            ))}
          </NativeSelect>
          <Button type="submit" variant="secondary">
            Find
          </Button>
        </form>
        {filters.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Filtered by</span>
            {filters.map((f) => (
              <span
                key={f.label}
                className="rounded-full bg-primary-soft px-3 py-1 font-medium text-primary-soft-foreground"
              >
                {f.label}
              </span>
            ))}
            <Link
              href={clearHref}
              className="inline-flex items-center gap-1 font-medium text-link hover:underline"
            >
              <X aria-hidden="true" className="size-4" /> Clear
            </Link>
          </div>
        ) : null}
      </PageHeader>
      <Container className="py-8">
        {page.items.length === 0 ? (
          <EmptyState
            icon={<Headphones />}
            title={filters.length ? 'No sermons match' : 'No sermons yet'}
            description={
              filters.length
                ? 'Try a different word, or clear the filters.'
                : 'Recorded sermons will appear here after each service.'
            }
            action={
              filters.length ? (
                <Link href={clearHref} className="text-sm font-medium text-link underline">
                  Clear filters
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {page.items.map((item) => (
              <li key={item.id}>
                <SermonCard item={item} headingLevel={2} />
              </li>
            ))}
            <LoadMore
              endpoint="/api/v1/sermons"
              variant="sermon"
              grid
              initialCursor={page.nextCursor}
              query={{
                branch: branchSlug,
                scope,
                speaker,
                series,
                tag,
                q,
                limit: String(PAGE_SIZE),
              }}
            />
          </ul>
        )}
      </Container>
    </>
  );
}
