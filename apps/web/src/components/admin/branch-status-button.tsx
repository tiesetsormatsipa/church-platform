'use client';

import { Button } from '@church/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@church/ui/dialog';
import { toast } from '@church/ui/toast';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError, ensureOk } from '@/lib/api/client';

/** Archive (hide from the site) or restore a branch. */
export function BranchStatusButton({
  slug,
  name,
  archived,
}: {
  slug: string;
  name: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function change() {
    setBusy(true);
    try {
      const path = { params: { path: { slug } } };
      ensureOk(
        archived
          ? await api.POST('/api/v1/admin/branches/{slug}/restore', path)
          : await api.POST('/api/v1/admin/branches/{slug}/archive', path),
      );
      toast({
        title: archived ? `${name} is visible again` : `${name} is archived`,
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

  if (archived) {
    return (
      <Button variant="secondary" onClick={change} loading={busy}>
        Restore branch
      </Button>
    );
  }
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" className="text-danger" />}>
        Archive…
      </DialogTrigger>
      <DialogContent
        title={`Archive ${name}?`}
        description="The branch and its content disappear from the site. Nothing is deleted, and you can restore it later."
      >
        <div className="flex justify-end gap-2 pt-2">
          <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
          <Button variant="danger" onClick={change} loading={busy}>
            Archive
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
