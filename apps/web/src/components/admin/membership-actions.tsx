'use client';

import type { AdminMembershipRow } from '@church/shared';
import { Button } from '@church/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@church/ui/dialog';
import { Field } from '@church/ui/field';
import { Textarea } from '@church/ui/input';
import { toast } from '@church/ui/toast';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError, ensureOk } from '@/lib/api/client';

type Decision = 'APPROVE' | 'REJECT' | 'REMOVE';

/** Approve, decline (with an optional note to the person) or remove a member. */
export function MembershipActions({ membership }: { membership: AdminMembershipRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Decision | null>(null);
  const [note, setNote] = useState('');
  const name = membership.person.name;

  async function decide(decision: Decision) {
    setBusy(decision);
    try {
      ensureOk(
        await api.POST('/api/v1/admin/memberships/{id}/decision', {
          params: { path: { id: membership.id } },
          body: { decision, note },
        }),
      );
      toast({
        title:
          decision === 'APPROVE'
            ? `${name} is now a member`
            : decision === 'REJECT'
              ? 'Request declined'
              : `${name} was removed`,
        tone: 'success',
      });
      router.refresh();
    } catch (error) {
      toast({
        title: 'That did not work',
        description: error instanceof ApiError ? error.message : undefined,
        tone: 'error',
      });
    } finally {
      setBusy(null);
    }
  }

  if (membership.status === 'PENDING') {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => decide('APPROVE')}
          loading={busy === 'APPROVE'}
          disabled={busy !== null}
        >
          Approve
        </Button>
        <Dialog>
          <DialogTrigger render={<Button size="sm" variant="secondary" disabled={busy !== null} />}>
            Decline…
          </DialogTrigger>
          <DialogContent
            title={`Decline ${name}’s request?`}
            description="They will see your note in their account."
          >
            <Field id={`note-${membership.id}`} label="Note to the person" optional>
              {(props) => (
                <Textarea
                  {...props}
                  rows={3}
                  maxLength={1000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="For example: please speak to us after the service first."
                />
              )}
            </Field>
            <div className="flex justify-end gap-2 pt-4">
              <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
              <Button variant="danger" onClick={() => decide('REJECT')} loading={busy === 'REJECT'}>
                Decline
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
  if (membership.status === 'ACTIVE') {
    return (
      <Dialog>
        <DialogTrigger render={<Button size="sm" variant="ghost" className="text-danger" />}>
          Remove…
        </DialogTrigger>
        <DialogContent
          title={`Remove ${name} from ${membership.branch.name}?`}
          description="They stop receiving member updates. They can ask to join again."
        >
          <div className="flex justify-end gap-2 pt-2">
            <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
            <Button variant="danger" onClick={() => decide('REMOVE')} loading={busy === 'REMOVE'}>
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  return null;
}
