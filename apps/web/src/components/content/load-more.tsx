'use client';

import type { ContentSummary } from '@church/shared';
import { cn } from '@church/ui/lib/cn';
import { ContentCard } from './content-card';
import { LoadMoreButton } from './load-more-button';
import { NewsCard } from './news-card';
import { SermonCard } from './sermon-card';
import { type PagedEndpoint, usePagedItems } from './use-paged-items';

const RENDER: Record<'card' | 'news' | 'sermon', (item: ContentSummary) => React.ReactNode> = {
  card: (item) => <ContentCard item={item} headingLevel={2} />,
  news: (item) => <NewsCard item={item} headingLevel={2} />,
  sermon: (item) => <SermonCard item={item} headingLevel={2} />,
};

/**
 * Appends further pages below a server-rendered first page. Renders `<li>` elements, so it
 * goes inside the listing's `<ul>` (grid listings pass `grid` so the button spans all columns).
 */
export function LoadMore({
  initialCursor,
  endpoint,
  query,
  variant = 'card',
  grid = false,
}: {
  initialCursor: string | null;
  endpoint: PagedEndpoint;
  query: Record<string, string | undefined>;
  variant?: 'card' | 'news' | 'sermon';
  grid?: boolean;
}) {
  const { items, hasMore, status, loadMore } = usePagedItems(endpoint, query, initialCursor);
  return (
    <>
      {items.map((item) => (
        <li key={item.id}>{RENDER[variant](item)}</li>
      ))}
      {hasMore || items.length > 0 ? (
        <li className={cn(grid && 'col-span-full')}>
          <LoadMoreButton hasMore={hasMore} status={status} onLoad={loadMore} loadedAny={items.length > 0} />
        </li>
      ) : null}
    </>
  );
}
