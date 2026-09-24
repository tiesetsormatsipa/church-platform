'use client';

import type { ContentPage, ContentSummary } from '@church/shared';
import { Button } from '@church/ui/button';
import { useState } from 'react';
import { ContentCard } from './content-card';

type PageLoader = (cursor: string) => Promise<ContentPage>;

/** Appends further pages below a server-rendered first page. */
export function LoadMore({
  initialCursor,
  endpoint,
  query,
}: {
  initialCursor: string | null;
  /** API path returning a ContentPage, e.g. "/api/v1/content". */
  endpoint: '/api/v1/content' | '/api/v1/events' | '/api/v1/sermons';
  query: Record<string, string | undefined>;
}) {
  const [items, setItems] = useState<ContentSummary[]>([]);
  const [cursor, setCursor] = useState(initialCursor);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const load: PageLoader = async (next) => {
    const params = new URLSearchParams({ ...Object.fromEntries(Object.entries(query).filter(([, v]) => v)), cursor: next });
    const response = await fetch(`${endpoint}?${params.toString()}`, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return (await response.json()) as ContentPage;
  };

  async function more() {
    if (!cursor) return;
    setStatus('loading');
    try {
      const page = await load(cursor);
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }

  return (
    <>
      {items.map((item) => (
        <li key={item.id}>
          <ContentCard item={item} />
        </li>
      ))}
      {cursor ? (
        <li className="flex flex-col items-center gap-2 pt-2">
          {status === 'error' ? (
            <p role="alert" className="text-sm text-danger">
              Could not load more. Check your connection and try again.
            </p>
          ) : null}
          <Button variant="secondary" onClick={more} loading={status === 'loading'}>
            {status === 'error' ? 'Try again' : 'Show more'}
          </Button>
        </li>
      ) : items.length > 0 ? (
        <li className="pt-2 text-center text-sm text-subtle">You have reached the end.</li>
      ) : null}
    </>
  );
}
