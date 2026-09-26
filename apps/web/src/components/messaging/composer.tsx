'use client';

import { Button } from '@church/ui/button';
import { Field } from '@church/ui/field';
import { toast } from '@church/ui/toast';
import { Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { api } from '@/lib/api/client';

const MESSAGE_MAX = 4000;

/**
 * Writing a reply.
 *
 * The write goes straight to the API from the browser (ADR-021), and the page is then asked
 * for fresh server data rather than the message being spliced in, so what is on screen is
 * always what the server actually stored.
 */
export function Composer({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [body, setBody] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    const { error } = await api.POST('/api/v1/me/messages/{id}/messages', {
      params: { path: { id: conversationId } },
      body: { body: text },
    });
    setBusy(false);
    if (error) {
      toast({ title: 'Could not send that message', tone: 'error' });
      return;
    }
    setBody('');
    router.refresh();
  }

  return (
    <form onSubmit={send} className="flex flex-col gap-3">
      <Field id="reply-body" label="Your reply">
        {(props) => (
          <textarea
            {...props}
            className="min-h-24 w-full rounded-lg border border-border bg-surface p-3 text-sm"
            value={body}
            maxLength={MESSAGE_MAX}
            placeholder="Write a message"
            onChange={(event) => setBody(event.target.value)}
          />
        )}
      </Field>
      <Button type="submit" loading={busy} disabled={body.trim().length === 0} className="self-end">
        <Send aria-hidden="true" />
        Send
      </Button>
    </form>
  );
}
