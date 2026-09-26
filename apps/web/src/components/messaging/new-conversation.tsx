'use client';

import type { DirectoryEntry } from '@church/shared';
import { Avatar } from '@church/ui/avatar';
import { Button } from '@church/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@church/ui/dialog';
import { Field } from '@church/ui/field';
import { Input } from '@church/ui/input';
import { toast } from '@church/ui/toast';
import { PenSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { api } from '@/lib/api/client';

const MESSAGE_MAX = 4000;

/**
 * Pick someone from your branch and say the first thing.
 *
 * The directory is fetched in the browser as the visitor types, because it is per-visitor
 * data that must never be cached, and because most visitors never open this dialog at all.
 */
export function NewConversation() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [people, setPeople] = React.useState<DirectoryEntry[] | null>(null);
  const [chosen, setChosen] = React.useState<DirectoryEntry | null>(null);
  const [body, setBody] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      const q = search.trim();
      void api
        .GET('/api/v1/me/messages/directory', {
          params: { query: q ? { q, limit: 20 } : { limit: 20 } },
        })
        .then(({ data }) => {
          if (!cancelled) setPeople(data?.items ?? []);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, search]);

  async function send() {
    const text = body.trim();
    if (!chosen || !text || busy) return;
    setBusy(true);
    const { data, error } = await api.POST('/api/v1/me/messages', {
      body: { userId: chosen.id, body: text },
    });
    setBusy(false);
    if (error || !data) {
      toast({ title: 'Could not send that message', tone: 'error' });
      return;
    }
    setOpen(false);
    setChosen(null);
    setBody('');
    router.push(`/messages/${data.conversationId}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="secondary" />}>
        <PenSquare aria-hidden="true" />
        Write to someone
      </DialogTrigger>
      <DialogContent
        title={chosen ? `Write to ${chosen.displayName}` : 'Who would you like to write to?'}
        description={
          chosen ? undefined : 'You can write to anyone who worships at a branch you belong to.'
        }
      >
        {chosen ? (
          <div className="flex flex-col gap-4">
            <Field id="new-message-body" label="Your message">
              {(props) => (
                <textarea
                  {...props}
                  className="min-h-32 w-full rounded-lg border border-border bg-surface p-3 text-sm"
                  value={body}
                  maxLength={MESSAGE_MAX}
                  onChange={(event) => setBody(event.target.value)}
                />
              )}
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setChosen(null)}>
                Back
              </Button>
              <Button onClick={send} loading={busy} disabled={body.trim().length === 0}>
                Send
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Field id="directory-search" label="Search by name">
              {(props) => (
                <Input
                  {...props}
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="A name"
                />
              )}
            </Field>
            {people === null ? (
              <p className="py-6 text-sm text-muted">Looking…</p>
            ) : people.length === 0 ? (
              <p className="py-6 text-sm text-muted">
                Nobody at your branch matches that. You can only write to members of a branch you
                belong to.
              </p>
            ) : (
              <ul className="flex max-h-72 flex-col divide-y divide-border overflow-y-auto">
                {people.map((person) => (
                  <li key={person.id}>
                    <button
                      type="button"
                      onClick={() => setChosen(person)}
                      className="flex w-full items-center gap-3 p-3 text-left hover:bg-surface-muted"
                    >
                      <Avatar name={person.displayName} src={person.avatarUrl} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{person.displayName}</span>
                        {person.branchName ? (
                          <span className="block truncate text-xs text-muted">
                            {person.branchName}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end">
              <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
