'use client';

import type { ContentPage, ContentSummary } from '@church/shared';
import { useState } from 'react';

export type PagedEndpoint = '/api/v1/content' | '/api/v1/events' | '/api/v1/sermons';

/** Loads further cursor pages of a server-rendered listing. */
export function usePagedItems(
  endpoint: PagedEndpoint,
  query: Record<string, string | undefined>,
  initialCursor: string | null,
) {
  const [items, setItems] = useState<ContentSummary[]>([]);
  const [cursor, setCursor] = useState(initialCursor);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  async function loadMore() {
    if (!cursor || status === 'loading') return;
    setStatus('loading');
    try {
      const params = new URLSearchParams({
        ...Object.fromEntries(Object.entries(query).filter(([, v]) => v)),
        cursor,
      });
      const response = await fetch(`${endpoint}?${params.toString()}`, {
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      const page = (await response.json()) as ContentPage;
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }

  return { items, hasMore: cursor !== null, status, loadMore };
}
