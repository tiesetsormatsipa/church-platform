'use client';

import type { AccountProfile, MembershipDto } from '@church/shared';
import { Alert } from '@church/ui/alert';
import { Badge } from '@church/ui/badge';
import { Button } from '@church/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@church/ui/dialog';
import { Field } from '@church/ui/field';
import { NativeSelect, Textarea } from '@church/ui/input';
import { toast } from '@church/ui/toast';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ensureOk } from '@/lib/api/client';
import { applyApiError } from '@/lib/forms';
import { formatDate } from '@/lib/format';
import { SubmitButton } from '@/components/forms/submit-button';

const STATUS: Record<
  MembershipDto['status'],
  { label: string; tone: 'success' | 'warning' | 'neutral' | 'danger' }
> = {
  ACTIVE: { label: 'Member', tone: 'success' },
  PENDING: { label: 'Waiting for review', tone: 'warning' },
  REJECTED: { label: 'Not approved', tone: 'danger' },
  LEFT: { label: 'Left', tone: 'neutral' },
};

function LeaveButton({
  membership,
  onDone,
}: {
  membership: MembershipDto;
  onDone: (m: MembershipDto) => void;
}) {
  const [busy, setBusy] = useState(false);
  const pending = membership.status === 'PENDING';
  async function leave() {
    setBusy(true);
    try {
      onDone(
        ensureOk(
          await api.DELETE('/api/v1/me/memberships/{id}', {
            params: { path: { id: membership.id } },
          }),
        ),
      );
      toast({
        title: pending ? 'Request withdrawn' : `You have left ${membership.branch.name}`,
        tone: 'success',
      });
    } catch {
      toast({ title: 'That did not work', description: 'Please try again.', tone: 'error' });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="secondary" size="sm" />}>
        {pending ? 'Withdraw request' : 'Leave branch'}
      </DialogTrigger>
      <DialogContent
        title={pending ? 'Withdraw your request?' : `Leave ${membership.branch.name}?`}
        description={
          pending
            ? `${membership.branch.name} will no longer see your request. You can ask again at any time.`
            : 'You will stop receiving member-only updates from this branch. You can ask to join again later.'
        }
      >
        <div className="flex justify-end gap-2 pt-2">
          <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
          <Button variant="danger" onClick={leave} loading={busy}>
            {pending ? 'Withdraw' : 'Leave'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Current branch membership, with request / withdraw / leave actions and history. */
export function MembershipPanel({
  profile,
  branches,
}: {
  profile: AccountProfile;
  branches: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const [memberships, setMemberships] = useState(profile.memberships);
  const [branch, setBranch] = useState(profile.homeBranch?.slug ?? '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const current =
    memberships.find((m) => m.isPrimary && (m.status === 'ACTIVE' || m.status === 'PENDING')) ??
    null;
  const history = memberships.filter((m) => m !== current);

  function replace(updated: MembershipDto) {
    setMemberships((prev) => [updated, ...prev.filter((m) => m.id !== updated.id)]);
    router.refresh();
  }

  async function request(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!branch) {
      setError('Choose a branch.');
      return;
    }
    setBusy(true);
    try {
      replace(ensureOk(await api.POST('/api/v1/me/memberships', { body: { branch, message } })));
      setMessage('');
      toast({
        title: 'Request sent',
        description: 'The branch will review it soon.',
        tone: 'success',
      });
    } catch (err) {
      setError(applyApiError(err, () => undefined, []));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {!profile.emailVerified ? (
        <Alert tone="warning">Confirm your e-mail address before asking to join a branch.</Alert>
      ) : current ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{current.branch.name}</p>
              <Badge tone={STATUS[current.status].tone}>{STATUS[current.status].label}</Badge>
            </div>
            <p className="text-sm text-muted">
              {current.status === 'ACTIVE' && current.decidedAt
                ? `Member since ${formatDate(current.decidedAt)}`
                : `Requested ${formatDate(current.requestedAt)}. The branch leaders will review it.`}
            </p>
          </div>
          <LeaveButton membership={current} onDone={replace} />
        </div>
      ) : (
        <form method="post" onSubmit={request} className="flex flex-col gap-4" noValidate>
          <p className="text-sm text-muted">
            Belonging to a branch lets its leaders know you and keep you informed.
          </p>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Field id="membership-branch" label="Branch">
            {(props) => (
              <NativeSelect {...props} value={branch} onChange={(e) => setBranch(e.target.value)}>
                <option value="" disabled>
                  Choose a branch
                </option>
                {branches.map((b) => (
                  <option key={b.slug} value={b.slug}>
                    {b.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <Field id="membership-message" label="Message to the branch" optional>
            {(props) => (
              <Textarea
                {...props}
                rows={3}
                maxLength={1000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            )}
          </Field>
          <SubmitButton loading={busy} className="self-start">
            Ask to join
          </SubmitButton>
        </form>
      )}

      {history.length > 0 ? (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-muted">Earlier requests</summary>
          <ul className="mt-3 flex flex-col divide-y divide-border">
            {history.map((m) => (
              <li key={m.id} className="flex flex-col gap-1 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{m.branch.name}</span>
                  <Badge tone={STATUS[m.status].tone}>{STATUS[m.status].label}</Badge>
                  <span className="text-muted">{formatDate(m.decidedAt ?? m.requestedAt)}</span>
                </div>
                {m.status === 'REJECTED' && m.decisionNote ? (
                  <p className="text-muted">{m.decisionNote}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
