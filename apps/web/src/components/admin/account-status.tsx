'use client';

import type { AdminUserDetail } from '@church/shared';
import { Button } from '@church/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@church/ui/dialog';
import { Field } from '@church/ui/field';
import { Input } from '@church/ui/input';
import { toast } from '@church/ui/toast';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError, ensureOk } from '@/lib/api/client';

/** Suspend (signs the person out everywhere) or reactivate an account. */
export function AccountStatus({ person }: { person: AdminUserDetail }) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const suspended = person.status === 'SUSPENDED';

  async function change(status: 'ACTIVE' | 'SUSPENDED') {
    setBusy(true);
    try {
      ensureOk(
        await api.PATCH('/api/v1/admin/users/{id}/status', {
          params: { path: { id: person.id } },
          body: { status, reason },
        }),
      );
      toast({
        title: status === 'SUSPENDED' ? 'Account suspended' : 'Account reactivated',
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
      setBusy(false);
    }
  }

  if (suspended) {
    return (
      <Button variant="secondary" onClick={() => change('ACTIVE')} loading={busy}>
        Reactivate account
      </Button>
    );
  }
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" className="text-danger" />}>
        Suspend account…
      </DialogTrigger>
      <DialogContent
        title={`Suspend ${person.name}?`}
        description="They are signed out everywhere and cannot sign in until the account is reactivated."
      >
        <Field id="suspend-reason" label="Reason" optional description="Recorded in the audit log.">
          {(props) => (
            <Input
              {...props}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
            />
          )}
        </Field>
        <div className="flex justify-end gap-2 pt-4">
          <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
          <Button variant="danger" onClick={() => change('SUSPENDED')} loading={busy}>
            Suspend
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
