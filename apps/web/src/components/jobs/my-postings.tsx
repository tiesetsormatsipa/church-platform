'use client';

import {
  type CreateJobPosting,
  EMPLOYMENT_TYPE_LABEL,
  EmploymentType,
  type MyJobPosting,
} from '@church/shared';
import { Alert } from '@church/ui/alert';
import { Badge } from '@church/ui/badge';
import { Button } from '@church/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@church/ui/dialog';
import { EmptyState } from '@church/ui/empty-state';
import { Field } from '@church/ui/field';
import { Input } from '@church/ui/input';
import { toast } from '@church/ui/toast';
import { Briefcase, PenSquare, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { api } from '@/lib/api/client';

const STATUS_LABEL: Record<MyJobPosting['status'], string> = {
  DRAFT: 'Draft',
  PENDING_REVIEW: 'Waiting to be read',
  PUBLISHED: 'On the board',
  ARCHIVED: 'Archived',
};

const STATUS_TONE: Record<MyJobPosting['status'], 'neutral' | 'warning' | 'success'> = {
  DRAFT: 'neutral',
  PENDING_REVIEW: 'warning',
  PUBLISHED: 'success',
  ARCHIVED: 'neutral',
};

type Draft = {
  title: string;
  summary: string;
  body: string;
  employerName: string;
  location: string;
  employmentType: EmploymentType;
  salaryRange: string;
  applyHow: 'email' | 'url';
  applyEmail: string;
  applyUrl: string;
  applyNote: string;
  closesOn: string;
};

const EMPTY: Draft = {
  title: '',
  summary: '',
  body: '',
  employerName: '',
  location: '',
  employmentType: 'FULL_TIME',
  salaryRange: '',
  applyHow: 'email',
  applyEmail: '',
  applyUrl: '',
  applyNote: '',
  closesOn: '',
};

function draftOf(posting: MyJobPosting): Draft {
  return {
    title: posting.title,
    summary: posting.summary ?? '',
    body: posting.body ?? '',
    employerName: posting.job.employerName,
    location: posting.job.location,
    employmentType: posting.job.employmentType,
    salaryRange: posting.job.salaryRange ?? '',
    applyHow: posting.job.applyUrl ? 'url' : 'email',
    applyEmail: posting.job.applyEmail ?? '',
    applyUrl: posting.job.applyUrl ?? '',
    applyNote: posting.job.applyNote ?? '',
    closesOn: posting.job.closesOn ?? '',
  };
}

function toBody(draft: Draft): CreateJobPosting {
  return {
    title: draft.title.trim(),
    summary: draft.summary.trim(),
    body: draft.body.trim(),
    employerName: draft.employerName.trim(),
    location: draft.location.trim(),
    employmentType: draft.employmentType,
    salaryRange: draft.salaryRange.trim(),
    applyNote: draft.applyNote.trim(),
    closesOn: draft.closesOn || null,
    applyEmail: draft.applyHow === 'email' ? draft.applyEmail.trim() : null,
    applyUrl: draft.applyHow === 'url' ? draft.applyUrl.trim() : null,
  };
}

export function MyPostings({ initial }: { initial: MyJobPosting[] }) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <PostingDialog
          trigger={
            <Button>
              <PenSquare aria-hidden="true" />
              Post an opening
            </Button>
          }
          title="Post an opening"
          initial={EMPTY}
          onSave={async (body) => api.POST('/api/v1/me/jobs', { body })}
          onSaved={() => router.refresh()}
        />
      </div>

      {initial.length === 0 ? (
        <EmptyState
          icon={<Briefcase aria-hidden="true" />}
          title="You have not posted anything yet"
          description="Post work you are offering and the church will read it before it goes on the board."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {initial.map((posting) => (
            <li
              key={posting.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-semibold">{posting.title}</span>
                <Badge tone={STATUS_TONE[posting.status]}>{STATUS_LABEL[posting.status]}</Badge>
              </div>
              <p className="text-sm text-muted">
                {posting.job.employerName} · {posting.job.location} ·{' '}
                {EMPLOYMENT_TYPE_LABEL[posting.job.employmentType]}
              </p>
              {posting.status === 'PENDING_REVIEW' ? (
                <Alert tone="info">
                  Someone at the church will read this before it appears on the board.
                </Alert>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {posting.status === 'PUBLISHED' ? (
                  <Link
                    href={`/jobs/${posting.slug}`}
                    className="inline-flex h-9 items-center rounded-lg border border-border-strong px-3 text-sm font-medium hover:bg-surface-muted"
                  >
                    View on the board
                  </Link>
                ) : null}
                {posting.canEdit ? (
                  <>
                    <PostingDialog
                      trigger={
                        <Button variant="secondary" size="sm">
                          <PenSquare aria-hidden="true" />
                          Edit
                        </Button>
                      }
                      title={`Edit “${posting.title}”`}
                      note="Any change sends the posting back to be read again, published or not."
                      initial={draftOf(posting)}
                      onSave={async (body) =>
                        api.PATCH('/api/v1/me/jobs/{id}', {
                          params: { path: { id: posting.id } },
                          body,
                        })
                      }
                      onSaved={() => router.refresh()}
                    />
                    <Withdraw id={posting.id} title={posting.title} />
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Withdraw({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function withdraw() {
    setBusy(true);
    const { error } = await api.DELETE('/api/v1/me/jobs/{id}', { params: { path: { id } } });
    setBusy(false);
    if (error) {
      toast({ title: 'Could not withdraw that posting', tone: 'error' });
      return;
    }
    toast({ title: 'Posting withdrawn', tone: 'success' });
    router.refresh();
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <Trash2 aria-hidden="true" />
        Withdraw<span className="sr-only"> {title}</span>
      </DialogTrigger>
      <DialogContent
        title="Withdraw this posting?"
        description="It comes off the board straight away. This cannot be undone."
        size="sm"
      >
        <div className="flex justify-end gap-2">
          <DialogClose render={<Button variant="ghost" />}>Keep it</DialogClose>
          <Button variant="danger" onClick={withdraw} loading={busy}>
            Withdraw
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface DialogProps {
  trigger: React.ReactElement;
  title: string;
  note?: string;
  initial: Draft;
  onSave: (body: CreateJobPosting) => Promise<{ error?: unknown }>;
  onSaved: () => void;
}

function PostingDialog({ trigger, title, note, initial, onSave, onSaved }: DialogProps) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const applyValue = draft.applyHow === 'email' ? draft.applyEmail : draft.applyUrl;
  const complete =
    draft.title.trim() && draft.employerName.trim() && draft.location.trim() && applyValue.trim();

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!complete || busy) return;
    setBusy(true);
    const { error } = await onSave(toBody(draft));
    setBusy(false);
    if (error) {
      toast({ title: 'Could not save that posting', tone: 'error' });
      return;
    }
    toast({ title: 'Sent to be read', tone: 'success' });
    setOpen(false);
    onSaved();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Opening starts from what the server now holds, not from a half-finished edit.
        if (next) setDraft(initial);
        setOpen(next);
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent title={title} description={note} size="lg">
        <form onSubmit={save} className="flex flex-col gap-4">
          <Field id="job-title" label="What is the role?">
            {(props) => (
              <Input
                {...props}
                value={draft.title}
                maxLength={200}
                required
                onChange={(e) => set('title', e.target.value)}
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="job-employer" label="Who is it for?">
              {(props) => (
                <Input
                  {...props}
                  value={draft.employerName}
                  maxLength={200}
                  required
                  onChange={(e) => set('employerName', e.target.value)}
                />
              )}
            </Field>
            <Field id="job-location" label="Where?" description="A town, a city, or “Remote”.">
              {(props) => (
                <Input
                  {...props}
                  value={draft.location}
                  maxLength={200}
                  required
                  onChange={(e) => set('location', e.target.value)}
                />
              )}
            </Field>
            <Field id="job-type" label="Kind of work">
              {(props) => (
                <select
                  {...props}
                  value={draft.employmentType}
                  onChange={(e) => set('employmentType', e.target.value as EmploymentType)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                >
                  {EmploymentType.values.map((value) => (
                    <option key={value} value={value}>
                      {EMPLOYMENT_TYPE_LABEL[value]}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field id="job-pay" label="Pay" optional description="However you would say it.">
              {(props) => (
                <Input
                  {...props}
                  value={draft.salaryRange}
                  maxLength={120}
                  onChange={(e) => set('salaryRange', e.target.value)}
                />
              )}
            </Field>
          </div>

          <Field id="job-summary" label="One line about it" optional>
            {(props) => (
              <Input
                {...props}
                value={draft.summary}
                maxLength={500}
                onChange={(e) => set('summary', e.target.value)}
              />
            )}
          </Field>

          <Field id="job-body" label="The details" optional>
            {(props) => (
              <textarea
                {...props}
                className="min-h-32 w-full rounded-lg border border-border bg-surface p-3 text-sm"
                value={draft.body}
                maxLength={8000}
                onChange={(e) => set('body', e.target.value)}
              />
            )}
          </Field>

          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium">How should people apply?</legend>
            <div className="flex gap-4">
              {(['email', 'url'] as const).map((how) => (
                <label key={how} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="applyHow"
                    value={how}
                    checked={draft.applyHow === how}
                    onChange={() => set('applyHow', how)}
                  />
                  {how === 'email' ? 'By e-mail' : 'On a website'}
                </label>
              ))}
            </div>
            {draft.applyHow === 'email' ? (
              <Field id="job-apply-email" label="E-mail address">
                {(props) => (
                  <Input
                    {...props}
                    type="email"
                    value={draft.applyEmail}
                    maxLength={254}
                    required
                    onChange={(e) => set('applyEmail', e.target.value)}
                  />
                )}
              </Field>
            ) : (
              <Field id="job-apply-url" label="Link to apply">
                {(props) => (
                  <Input
                    {...props}
                    type="url"
                    value={draft.applyUrl}
                    maxLength={2048}
                    required
                    placeholder="https://"
                    onChange={(e) => set('applyUrl', e.target.value)}
                  />
                )}
              </Field>
            )}
            <Field id="job-apply-note" label="Anything else they should send?" optional>
              {(props) => (
                <Input
                  {...props}
                  value={draft.applyNote}
                  maxLength={500}
                  onChange={(e) => set('applyNote', e.target.value)}
                />
              )}
            </Field>
          </fieldset>

          <Field id="job-closes" label="Closing date" optional>
            {(props) => (
              <Input
                {...props}
                type="date"
                value={draft.closesOn}
                onChange={(e) => set('closesOn', e.target.value)}
              />
            )}
          </Field>

          <div className="flex justify-end gap-2">
            <DialogClose render={<Button variant="ghost" type="button" />}>Cancel</DialogClose>
            <Button type="submit" loading={busy} disabled={!complete}>
              Send to be read
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
