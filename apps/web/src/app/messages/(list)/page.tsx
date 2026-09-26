import { Avatar } from '@church/ui/avatar';
import { Container } from '@church/ui/container';
import { EmptyState } from '@church/ui/empty-state';
import { Input } from '@church/ui/input';
import { cn } from '@church/ui/lib/cn';
import { MessageSquare, Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/content/page-header';
import { NewConversation } from '@/components/messaging/new-conversation';
import { unwrap, userApi } from '@/lib/api/server';
import { formatRelative } from '@/lib/format';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Messages',
  robots: { index: false },
};

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function MessagesPage({ searchParams }: PageProps) {
  await requireUser('/messages');
  const q = (await searchParams).q?.trim() ?? '';
  const client = await userApi();
  const page = await client
    .GET('/api/v1/me/messages', { params: { query: q ? { q } : {} } })
    .then(unwrap);

  return (
    <>
      <PageHeader
        eyebrow="Your account"
        title="Messages"
        description="Write to the people you worship with."
      />
      <Container className="py-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <form method="get" className="flex min-w-52 flex-1 items-end gap-2">
              <label htmlFor="messages-search" className="sr-only">
                Search your conversations
              </label>
              <Input
                id="messages-search"
                name="q"
                type="search"
                defaultValue={q}
                placeholder="A name, or something that was said"
              />
              <button
                type="submit"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-border-strong bg-surface px-4 text-sm font-medium hover:bg-surface-muted"
              >
                <Search aria-hidden="true" className="size-4" />
                Search
              </button>
            </form>
            <NewConversation />
          </div>

          {page.items.length === 0 ? (
            <EmptyState
              icon={<MessageSquare aria-hidden="true" />}
              title={q ? 'Nothing matches that' : 'No conversations yet'}
              description={
                q
                  ? 'Try a different name or word.'
                  : 'Write to someone at your branch and the conversation will appear here.'
              }
            />
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
              {page.items.map((conversation) => {
                const name =
                  conversation.subject ||
                  conversation.others.map((p) => p.displayName).join(', ') ||
                  'A member';
                return (
                  <li key={conversation.id}>
                    <Link
                      href={`/messages/${conversation.id}`}
                      className="flex items-center gap-3 p-4 hover:bg-surface-muted"
                    >
                      <Avatar name={name} src={conversation.others[0]?.avatarUrl} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span
                            className={cn(
                              'truncate',
                              conversation.unread > 0 ? 'font-semibold' : 'font-medium',
                            )}
                          >
                            {name}
                          </span>
                          {conversation.lastMessage ? (
                            <time
                              dateTime={conversation.lastMessage.createdAt}
                              className="shrink-0 text-xs text-muted"
                            >
                              {formatRelative(conversation.lastMessage.createdAt)}
                            </time>
                          ) : null}
                        </span>
                        <span className="mt-0.5 flex items-center gap-2">
                          <span className="truncate text-sm text-muted">
                            {conversation.lastMessage
                              ? `${conversation.lastMessage.mine ? 'You: ' : ''}${conversation.lastMessage.body}`
                              : 'No messages yet'}
                          </span>
                          {conversation.unread > 0 ? (
                            <span className="ml-auto shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                              {conversation.unread}
                              <span className="sr-only"> unread</span>
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Container>
    </>
  );
}
