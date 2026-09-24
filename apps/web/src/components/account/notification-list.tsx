'use client';

import type { NotificationDto } from '@church/shared';
import { Button } from '@church/ui/button';
import { EmptyState } from '@church/ui/empty-state';
import { cn } from '@church/ui/lib/cn';
import { BellOff, Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { api } from '@/lib/api/client';
import { toast } from '@church/ui/toast';

interface Props {
  initial: NotificationDto[];
  initialCursor: string | null;
  initialUnread: number;
}

/**
 * The notification centre. Reading is a mutation, so it happens in the browser: opening a
 * notification marks it read on the way out, and "Mark all as read" clears the badge.
 */
export function NotificationList({ initial, initialCursor, initialUnread }: Props) {
  const router = useRouter();
  const [items, setItems] = React.useState(initial);
  const [cursor, setCursor] = React.useState(initialCursor);
  const [unread, setUnread] = React.useState(initialUnread);
  const [busy, setBusy] = React.useState(false);

  async function loadMore() {
    if (!cursor || busy) return;
    setBusy(true);
    const { data, error } = await api.GET('/api/v1/me/notifications', {
      params: { query: { cursor, limit: 20 } },
    });
    setBusy(false);
    if (error || !data) {
      toast({ title: 'Could not load more', tone: 'error' });
      return;
    }
    setItems((current) => [...current, ...data.items]);
    setCursor(data.nextCursor);
  }

  async function markRead(ids: string[] | 'all') {
    const body = ids === 'all' ? { all: true } : { ids };
    const { data, error } = await api.POST('/api/v1/me/notifications/read', { body });
    if (error || !data) {
      toast({ title: 'Could not mark as read', tone: 'error' });
      return;
    }
    const now = new Date().toISOString();
    setItems((current) =>
      current.map((item) =>
        (ids === 'all' || ids.includes(item.id)) && !item.readAt ? { ...item, readAt: now } : item,
      ),
    );
    setUnread(data.unread);
    // The header badge is server-rendered, so ask for fresh server data.
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<BellOff aria-hidden="true" />}
        title="No notifications yet"
        description="When something is published for you, or your membership is reviewed, it appears here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted" aria-live="polite">
          {unread === 0 ? 'All caught up.' : `${unread} unread`}
        </p>
        {unread > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => void markRead('all')}>
            <Check aria-hidden="true" /> Mark all as read
          </Button>
        ) : null}
      </div>

      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          const isUnread = !item.readAt;
          const content = (
            <>
              <span className="flex items-start gap-2">
                {isUnread ? (
                  <span
                    aria-hidden="true"
                    className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                  />
                ) : (
                  <span aria-hidden="true" className="mt-1.5 size-2 shrink-0" />
                )}
                <span className="min-w-0">
                  <span className={cn('block', isUnread && 'font-semibold')}>
                    {item.title}
                    {isUnread ? <span className="sr-only"> (unread)</span> : null}
                  </span>
                  {item.body ? (
                    <span className="mt-0.5 block text-sm text-muted">{item.body}</span>
                  ) : null}
                  <time
                    dateTime={item.createdAt}
                    className="text-muted-strong mt-1 block text-xs"
                    suppressHydrationWarning
                  >
                    {new Date(item.createdAt).toLocaleString()}
                  </time>
                </span>
              </span>
            </>
          );

          return (
            <li key={item.id}>
              {item.url ? (
                <Link
                  href={item.url}
                  onClick={() => {
                    if (isUnread) void markRead([item.id]);
                  }}
                  className="block rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {content}
                </Link>
              ) : (
                <div className="rounded-lg border border-border bg-surface p-4">
                  {content}
                  {isUnread ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => void markRead([item.id])}
                    >
                      Mark as read<span className="sr-only">: {item.title}</span>
                    </Button>
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {cursor ? (
        <Button variant="secondary" onClick={() => void loadMore()} disabled={busy}>
          {busy ? 'Loading…' : 'Show older notifications'}
        </Button>
      ) : null}
    </div>
  );
}
