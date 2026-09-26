import { Avatar } from '@church/ui/avatar';
import { Container } from '@church/ui/container';
import { cn } from '@church/ui/lib/cn';
import { ArrowLeft, ChevronUp } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/content/page-header';
import { Composer } from '@/components/messaging/composer';
import { MarkRead } from '@/components/messaging/mark-read';
import { unwrap, userApi } from '@/lib/api/server';
import { formatRelative } from '@/lib/format';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Conversation',
  robots: { index: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ before?: string }>;
}

export default async function ConversationPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  await requireUser(`/messages/${id}`);
  const { before } = await searchParams;

  const client = await userApi();
  const page = await client
    .GET('/api/v1/me/messages/{id}', {
      params: { path: { id }, query: before ? { before } : {} },
    })
    .then(unwrap);

  const others = page.conversation.others;
  const title =
    page.conversation.subject || others.map((p) => p.displayName).join(', ') || 'A member';

  return (
    <>
      <MarkRead conversationId={id} unread={page.conversation.unread} />
      <PageHeader
        eyebrow={
          <Link href="/messages" className="inline-flex items-center gap-1 text-link">
            <ArrowLeft aria-hidden="true" className="size-4" />
            All messages
          </Link>
        }
        title={title}
      />
      <Container className="py-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          {page.olderCursor ? (
            <Link
              href={`/messages/${id}?before=${encodeURIComponent(page.olderCursor)}`}
              className="inline-flex items-center justify-center gap-2 self-center rounded-lg border border-border-strong bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-muted"
            >
              <ChevronUp aria-hidden="true" className="size-4" />
              Show earlier messages
            </Link>
          ) : null}

          <ol className="flex flex-col gap-4">
            {page.items.map((message) => (
              <li
                key={message.id}
                className={cn('flex gap-3', message.mine && 'flex-row-reverse text-right')}
              >
                <Avatar
                  name={message.sender?.displayName ?? 'A member'}
                  src={message.sender?.avatarUrl}
                  size="sm"
                  className="mt-1"
                />
                <div className="max-w-[80%] min-w-0">
                  <p className="text-xs text-muted">
                    <span className="font-medium text-foreground">
                      {message.mine ? 'You' : (message.sender?.displayName ?? 'A member')}
                    </span>{' '}
                    <time dateTime={message.createdAt}>{formatRelative(message.createdAt)}</time>
                  </p>
                  <p
                    className={cn(
                      'mt-1 inline-block rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap',
                      message.mine
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-surface-muted text-foreground',
                    )}
                  >
                    {message.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          {before ? (
            <Link href={`/messages/${id}`} className="self-center text-sm text-link">
              Back to the newest messages
            </Link>
          ) : (
            <Composer conversationId={id} />
          )}
        </div>
      </Container>
    </>
  );
}
