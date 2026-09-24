import { CONTENT_TYPE_LABEL, ContentType, type SearchResponse } from '@church/shared';
import { Alert } from '@church/ui/alert';
import { Button } from '@church/ui/button';
import { Container } from '@church/ui/container';
import { EmptyState } from '@church/ui/empty-state';
import { Input } from '@church/ui/input';
import { chipClass } from '@church/ui/segmented';
import { MapPin, Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentCard } from '@/components/content/content-card';
import { PageHeader } from '@/components/content/page-header';
import { visitorApi } from '@/lib/api/server';
import { href, param } from '@/lib/context';

export async function generateMetadata({ searchParams }: PageProps<'/search'>): Promise<Metadata> {
  const q = param(await searchParams, 'q')?.trim();
  return {
    title: q ? `Search: ${q.slice(0, 60)}` : 'Search',
    // Result pages are not useful in search engines.
    robots: { index: false, follow: true },
  };
}

const SUGGESTIONS = [
  { href: '/events', label: 'Upcoming events' },
  { href: '/sermons', label: 'Sermons' },
  { href: '/branches', label: 'Branches and service times' },
  { href: '/baptism', label: 'Baptism' },
];

export default async function SearchPage({ searchParams }: PageProps<'/search'>) {
  const params = await searchParams;
  const q = param(params, 'q')?.trim().slice(0, 100) ?? '';
  const type = ContentType.schema.safeParse(param(params, 'types')?.toUpperCase()).data;
  const ready = q.length >= 2;

  let results: SearchResponse | null = null;
  let failure: string | null = null;
  if (ready) {
    const client = await visitorApi();
    const { data, response } = await client.GET('/api/v1/search', {
      params: { query: { q, types: type?.toLowerCase(), limit: 30 } },
    });
    if (data) results = data;
    else
      failure =
        response.status === 429
          ? 'You have searched a lot in a short time. Please wait a minute and try again.'
          : 'Search is not available right now. Please try again shortly.';
  }
  const total = results ? results.content.length + results.branches.length : 0;

  return (
    <>
      <PageHeader title="Search" description="Find news, events, sermons and branches.">
        <form method="get" action="/search" role="search" className="flex gap-2">
          <div className="relative flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
            />
            <Input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search the site"
              aria-label="Search the site"
              minLength={2}
              maxLength={100}
              className="pl-9"
            />
          </div>
          {type ? <input type="hidden" name="types" value={type.toLowerCase()} /> : null}
          <Button type="submit">Search</Button>
        </form>
        {ready ? (
          <nav
            aria-label="Filter results by type"
            className="relative -mx-4 scrollbar-none overflow-x-auto px-4 sm:mx-0 sm:px-0"
          >
            <ul className="flex gap-2">
              <li>
                <Link
                  href={href('/search', { q })}
                  aria-current={!type ? 'page' : undefined}
                  className={chipClass(!type)}
                >
                  Everything
                </Link>
              </li>
              {ContentType.values.map((t) => (
                <li key={t}>
                  <Link
                    href={href('/search', { q, types: t.toLowerCase() })}
                    aria-current={type === t ? 'page' : undefined}
                    className={chipClass(type === t)}
                  >
                    {CONTENT_TYPE_LABEL[t].plural}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </PageHeader>
      <Container className="py-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-8">
          {!ready ? (
            <div className="flex flex-col gap-3">
              <p className="text-muted">
                {q ? 'Type at least two letters to search.' : 'Or go straight to:'}
              </p>
              <ul className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <li key={s.href}>
                    <Link href={s.href} className={chipClass(false)}>
                      {s.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : failure ? (
            <Alert tone="warning">{failure}</Alert>
          ) : total === 0 ? (
            <EmptyState
              icon={<Search />}
              title={`Nothing found for “${q}”`}
              description="Check the spelling, try fewer or different words, or browse the feed."
              action={
                <Link href="/feed" className="text-sm font-medium text-link underline">
                  Browse the feed
                </Link>
              }
            />
          ) : (
            <>
              <p role="status" className="text-sm text-muted">
                {total} {total === 1 ? 'result' : 'results'} for{' '}
                <strong className="text-foreground">“{q}”</strong>
              </p>
              {results && results.branches.length > 0 && !type ? (
                <section aria-labelledby="branch-results" className="flex flex-col gap-3">
                  <h2 id="branch-results" className="text-lg font-semibold">
                    Branches
                  </h2>
                  <ul className="flex flex-wrap gap-2">
                    {results.branches.map((b) => (
                      <li key={b.id}>
                        <Link href={`/branches/${b.slug}`} className={chipClass(false)}>
                          <MapPin aria-hidden="true" /> {b.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {results && results.content.length > 0 ? (
                <section aria-labelledby="content-results" className="flex flex-col gap-3">
                  <h2 id="content-results" className="text-lg font-semibold">
                    News, events and sermons
                  </h2>
                  <ul className="flex flex-col gap-4">
                    {results.content.map((item) => (
                      <li key={item.id}>
                        <ContentCard item={item} />
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </div>
      </Container>
    </>
  );
}
