'use client';

import { type AdminBaptismRequest, BaptismRequestStatus } from '@church/shared';
import { Button } from '@church/ui/button';
import { Field } from '@church/ui/field';
import { NativeSelect, Textarea } from '@church/ui/input';
import { toast } from '@church/ui/toast';
import { Mail, Phone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError, ensureOk } from '@/lib/api/client';
import { formatCalendarDate, formatDate } from '@/lib/format';
import { useSession } from '@/lib/hooks/use-session';
import { BAPTISM_STATUS_LABEL, BaptismStatusBadge } from './status-badges';

/** One enquiry: contact details, the person's message, and follow-up tracking. */
export function BaptismRequestCard({ request }: { request: AdminBaptismRequest }) {
  const router = useRouter();
  const { user } = useSession();
  const [status, setStatus] = useState(request.status);
  const [notes, setNotes] = useState(request.internalNotes ?? '');
  const [busy, setBusy] = useState(false);
  const dirty = status !== request.status || notes !== (request.internalNotes ?? '');
  const mine = user && request.assignee?.id === user.id;

  async function save(body: {
    status?: typeof status;
    internalNotes?: string;
    assigneeId?: string | null;
  }) {
    setBusy(true);
    try {
      ensureOk(
        await api.PATCH('/api/v1/admin/baptism-requests/{id}', {
          params: { path: { id: request.id } },
          body,
        }),
      );
      toast({ title: 'Saved', tone: 'success' });
      router.refresh();
    } catch (error) {
      toast({
        title: 'Could not save',
        description: error instanceof ApiError ? error.message : undefined,
        tone: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-card">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">{request.fullName}</h2>
          <p className="text-sm text-muted">
            {request.branch.name} · received {formatDate(request.createdAt)}
            {request.preferredDate
              ? ` · hoping for ${formatCalendarDate(request.preferredDate)}`
              : ''}
            {request.hasAccount ? ' · has an account' : ''}
          </p>
        </div>
        <BaptismStatusBadge status={request.status} />
      </header>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <a
          href={`mailto:${request.email}`}
          className="inline-flex items-center gap-1.5 font-medium break-all text-link hover:underline"
        >
          <Mail aria-hidden="true" className="size-4 shrink-0" /> {request.email}
        </a>
        {request.phone ? (
          <a
            href={`tel:${request.phone.replace(/\s+/g, '')}`}
            className="inline-flex items-center gap-1.5 font-medium text-link hover:underline"
          >
            <Phone aria-hidden="true" className="size-4" /> {request.phone}
          </a>
        ) : null}
      </div>
      {request.message ? (
        <blockquote className="border-l-2 border-border-strong pl-3 text-sm whitespace-pre-line">
          {request.message}
        </blockquote>
      ) : null}
      <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
        <Field id={`status-${request.id}`} label="Stage">
          {(props) => (
            <NativeSelect
              {...props}
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
            >
              {BaptismRequestStatus.values.map((s) => (
                <option key={s} value={s}>
                  {BAPTISM_STATUS_LABEL[s]}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field
          id={`notes-${request.id}`}
          label="Notes for the team"
          optional
          description="Only administrators of this branch can see these."
        >
          {(props) => (
            <Textarea
              {...props}
              rows={2}
              maxLength={4000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          )}
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {request.assignee
            ? `Followed up by ${mine ? 'you' : request.assignee.name}`
            : 'Nobody is following this up yet.'}
        </p>
        <div className="flex flex-wrap gap-2">
          {!mine && user ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => save({ assigneeId: user.id })}
              disabled={busy}
            >
              I’ll follow up
            </Button>
          ) : null}
          <Button
            size="sm"
            onClick={() => save({ status, internalNotes: notes })}
            loading={busy}
            disabled={!dirty}
          >
            Save
          </Button>
        </div>
      </div>
    </article>
  );
}
