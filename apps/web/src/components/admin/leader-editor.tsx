'use client';

import { type AdminLeaderDto, LeaderInput } from '@church/shared';
import { Alert } from '@church/ui/alert';
import { Avatar } from '@church/ui/avatar';
import { Badge } from '@church/ui/badge';
import { Button } from '@church/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@church/ui/dialog';
import { Field } from '@church/ui/field';
import { Checkbox, Input, Textarea } from '@church/ui/input';
import { toast } from '@church/ui/toast';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError, ensureOk } from '@/lib/api/client';

function LeaderDialog({
  slug,
  leader,
  trigger,
  label,
}: {
  slug: string;
  leader: AdminLeaderDto | null;
  trigger: React.ReactElement;
  label: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(leader?.name ?? '');
  const [title, setTitle] = useState(leader?.title ?? '');
  const [bio, setBio] = useState(leader?.bio ?? '');
  const [sortOrder, setSortOrder] = useState(String(leader?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(leader?.isActive ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const parsed = LeaderInput.safeParse({
      name,
      title,
      bio,
      sortOrder: Number(sortOrder) || 0,
      isActive,
    });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      if (leader) {
        ensureOk(
          await api.PUT('/api/v1/admin/branches/{slug}/leaders/{id}', {
            params: { path: { slug, id: leader.id } },
            body: parsed.data,
          }),
        );
      } else {
        ensureOk(
          await api.POST('/api/v1/admin/branches/{slug}/leaders', {
            params: { path: { slug } },
            body: parsed.data,
          }),
        );
        setName('');
        setTitle('');
        setBio('');
      }
      toast({ title: 'Leaders updated', tone: 'success' });
      setOpen(false);
      router.refresh();
    } catch (error) {
      setErrors({ form: error instanceof ApiError ? error.message : 'Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger}>{label}</DialogTrigger>
      <DialogContent
        title={leader ? 'Edit leader' : 'Add a leader'}
        description="Shown on the branch page."
      >
        <form onSubmit={save} noValidate className="flex flex-col gap-4">
          {errors.form ? <Alert tone="danger">{errors.form}</Alert> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="leader-name"
              label="Name"
              error={errors.name}
              description="As the congregation knows them, e.g. “Elder T. Nkosi”."
            >
              {(props) => (
                <Input {...props} value={name} onChange={(e) => setName(e.target.value)} />
              )}
            </Field>
            <Field id="leader-title" label="Role" error={errors.title}>
              {(props) => (
                <Input
                  {...props}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Overseer"
                />
              )}
            </Field>
          </div>
          <Field id="leader-bio" label="A few words" optional error={errors.bio}>
            {(props) => (
              <Textarea
                {...props}
                rows={3}
                maxLength={1000}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            )}
          </Field>
          <Field
            id="leader-order"
            label="Position"
            error={errors.sortOrder}
            description="Lower numbers are listed first."
          >
            {(props) => (
              <Input
                {...props}
                type="number"
                min={0}
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="max-w-32"
              />
            )}
          </Field>
          <div className="flex items-start gap-2">
            <Checkbox
              id="leader-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <label htmlFor="leader-active" className="text-sm">
              Show on the site
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <DialogClose render={<Button type="button" variant="ghost" />}>Cancel</DialogClose>
            <Button type="submit" loading={busy}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LeaderEditor({ slug, leaders }: { slug: string; leaders: AdminLeaderDto[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function remove(id: string) {
    setBusy(id);
    try {
      ensureOk(
        await api.DELETE('/api/v1/admin/branches/{slug}/leaders/{id}', {
          params: { path: { slug, id } },
        }),
      );
      toast({ title: 'Removed', tone: 'success' });
      router.refresh();
    } catch {
      toast({ title: 'Could not remove them', tone: 'error' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {leaders.length === 0 ? (
        <p className="text-sm text-muted">No leaders listed yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {leaders.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-3">
                <Avatar name={l.name} />
                <div className="flex flex-col">
                  <span className="flex items-center gap-2 font-medium">
                    {l.name}
                    {!l.isActive ? <Badge tone="outline">Hidden</Badge> : null}
                  </span>
                  <span className="text-sm text-muted">{l.title}</span>
                </div>
              </div>
              <div className="flex gap-1">
                <LeaderDialog
                  slug={slug}
                  leader={l}
                  trigger={<Button size="sm" variant="ghost" />}
                  label={
                    <>
                      Edit<span className="sr-only"> {l.name}</span>
                    </>
                  }
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger"
                  onClick={() => remove(l.id)}
                  loading={busy === l.id}
                >
                  Remove<span className="sr-only"> {l.name}</span>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <LeaderDialog
        slug={slug}
        leader={null}
        trigger={<Button variant="secondary" size="sm" className="self-start" />}
        label={
          <>
            <Plus aria-hidden="true" /> Add a leader
          </>
        }
      />
    </div>
  );
}
