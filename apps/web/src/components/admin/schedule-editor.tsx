'use client';

import {
  type AdminScheduleDto,
  SCHEDULE_KIND_LABEL,
  ScheduleInput,
  ScheduleKind,
} from '@church/shared';
import { Alert } from '@church/ui/alert';
import { Badge } from '@church/ui/badge';
import { Button } from '@church/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@church/ui/dialog';
import { Field } from '@church/ui/field';
import { Checkbox, Input, NativeSelect } from '@church/ui/input';
import { toast } from '@church/ui/toast';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError, ensureOk } from '@/lib/api/client';
import { formatCalendarDate, WEEKDAYS } from '@/lib/format';

interface Draft {
  kind: string;
  title: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  recurrenceText: string;
  notes: string;
  effectiveFrom: string;
  effectiveUntil: string;
  replacesRegular: boolean;
  isActive: boolean;
}

function draftOf(s: AdminScheduleDto | null): Draft {
  return {
    kind: s?.kind ?? 'SERVICE',
    title: s?.title ?? '',
    dayOfWeek: s?.dayOfWeek != null ? String(s.dayOfWeek) : '0',
    startTime: s?.startTime ?? '',
    endTime: s?.endTime ?? '',
    recurrenceText: s?.recurrenceText ?? '',
    notes: s?.notes ?? '',
    effectiveFrom: s?.effectiveFrom ?? '',
    effectiveUntil: s?.effectiveUntil ?? '',
    replacesRegular: s?.replacesRegular ?? false,
    isActive: s?.isActive ?? true,
  };
}

function when(s: AdminScheduleDto): string {
  const day = s.dayOfWeek !== null ? WEEKDAYS[s.dayOfWeek] : s.recurrenceText;
  const time = s.startTime ? (s.endTime ? `${s.startTime}–${s.endTime}` : s.startTime) : '';
  return [day, time].filter(Boolean).join(' · ');
}

function ScheduleDialog({
  slug,
  schedule,
  trigger,
  label,
}: {
  slug: string;
  schedule: AdminScheduleDto | null;
  trigger: React.ReactElement;
  label: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(draftOf(schedule));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDraft((d) => ({
      ...d,
      [key]:
        e.target instanceof HTMLInputElement && e.target.type === 'checkbox'
          ? e.target.checked
          : e.target.value,
    }));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const payload = {
      ...draft,
      dayOfWeek: draft.dayOfWeek === '' ? null : Number(draft.dayOfWeek),
      startTime: draft.startTime || null,
      endTime: draft.endTime || null,
      effectiveFrom: draft.effectiveFrom || null,
      effectiveUntil: draft.effectiveUntil || null,
    };
    const parsed = ScheduleInput.safeParse(payload);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      if (schedule) {
        ensureOk(
          await api.PUT('/api/v1/admin/branches/{slug}/schedules/{id}', {
            params: { path: { slug, id: schedule.id } },
            body: parsed.data,
          }),
        );
      } else {
        ensureOk(
          await api.POST('/api/v1/admin/branches/{slug}/schedules', {
            params: { path: { slug } },
            body: parsed.data,
          }),
        );
      }
      toast({ title: 'Service times updated', tone: 'success' });
      setOpen(false);
      if (!schedule) setDraft(draftOf(null));
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
        title={schedule ? 'Edit time' : 'Add a time'}
        description="Regular weekly times, or a temporary change with dates."
      >
        <form onSubmit={save} noValidate className="flex flex-col gap-4">
          {errors.form ? <Alert tone="danger">{errors.form}</Alert> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="schedule-kind" label="What">
              {(props) => (
                <NativeSelect {...props} value={draft.kind} onChange={set('kind')}>
                  {ScheduleKind.values.map((k) => (
                    <option key={k} value={k}>
                      {SCHEDULE_KIND_LABEL[k]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field
              id="schedule-title"
              label="Name"
              optional
              error={errors.title}
              description="For example “Sunday service”."
            >
              {(props) => <Input {...props} value={draft.title} onChange={set('title')} />}
            </Field>
            <Field id="schedule-day" label="Day" error={errors.dayOfWeek}>
              {(props) => (
                <NativeSelect {...props} value={draft.dayOfWeek} onChange={set('dayOfWeek')}>
                  {WEEKDAYS.map((d, i) => (
                    <option key={d} value={String(i)}>
                      {d}
                    </option>
                  ))}
                  <option value="">Not weekly (describe below)</option>
                </NativeSelect>
              )}
            </Field>
            <Field
              id="schedule-recurrence"
              label="Or describe when"
              optional
              error={errors.recurrenceText}
              description="For example “First Sunday of the month”."
            >
              {(props) => (
                <Input {...props} value={draft.recurrenceText} onChange={set('recurrenceText')} />
              )}
            </Field>
            <Field id="schedule-start" label="Starts" optional error={errors.startTime}>
              {(props) => (
                <Input {...props} type="time" value={draft.startTime} onChange={set('startTime')} />
              )}
            </Field>
            <Field id="schedule-end" label="Ends" optional error={errors.endTime}>
              {(props) => (
                <Input {...props} type="time" value={draft.endTime} onChange={set('endTime')} />
              )}
            </Field>
            <Field
              id="schedule-from"
              label="Only from"
              optional
              error={errors.effectiveFrom}
              description="For temporary changes."
            >
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  value={draft.effectiveFrom}
                  onChange={set('effectiveFrom')}
                />
              )}
            </Field>
            <Field id="schedule-until" label="Until" optional error={errors.effectiveUntil}>
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  value={draft.effectiveUntil}
                  onChange={set('effectiveUntil')}
                />
              )}
            </Field>
          </div>
          <Field id="schedule-notes" label="Note" optional error={errors.notes}>
            {(props) => <Input {...props} value={draft.notes} onChange={set('notes')} />}
          </Field>
          <div className="flex items-start gap-2">
            <Checkbox
              id="schedule-replaces"
              checked={draft.replacesRegular}
              onChange={set('replacesRegular')}
            />
            <label htmlFor="schedule-replaces" className="text-sm">
              Replaces the usual time of this kind on those dates
            </label>
          </div>
          <div className="flex items-start gap-2">
            <Checkbox id="schedule-active" checked={draft.isActive} onChange={set('isActive')} />
            <label htmlFor="schedule-active" className="text-sm">
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

/** A branch's service times, including temporary changes. */
export function ScheduleEditor({
  slug,
  schedules,
}: {
  slug: string;
  schedules: AdminScheduleDto[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function remove(id: string) {
    setBusy(id);
    try {
      ensureOk(
        await api.DELETE('/api/v1/admin/branches/{slug}/schedules/{id}', {
          params: { path: { slug, id } },
        }),
      );
      toast({ title: 'Removed', tone: 'success' });
      router.refresh();
    } catch {
      toast({ title: 'Could not remove it', tone: 'error' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {schedules.length === 0 ? (
        <p className="text-sm text-muted">No service times yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {schedules.map((s) => {
            const temporary = s.effectiveFrom !== null || s.effectiveUntil !== null;
            return (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex flex-col">
                  <span className="flex flex-wrap items-center gap-2 font-medium">
                    {s.title ?? SCHEDULE_KIND_LABEL[s.kind]}
                    {temporary ? <Badge tone="warning">Temporary</Badge> : null}
                    {!s.isActive ? <Badge tone="outline">Hidden</Badge> : null}
                  </span>
                  <span className="text-sm text-muted">
                    {when(s)}
                    {temporary
                      ? ` · ${s.effectiveFrom ? `from ${formatCalendarDate(s.effectiveFrom)}` : ''}${s.effectiveUntil ? ` until ${formatCalendarDate(s.effectiveUntil)}` : ''}`
                      : ''}
                  </span>
                </div>
                <div className="flex gap-1">
                  <ScheduleDialog
                    slug={slug}
                    schedule={s}
                    trigger={<Button size="sm" variant="ghost" />}
                    label={
                      <>
                        Edit
                        <span className="sr-only"> {s.title ?? SCHEDULE_KIND_LABEL[s.kind]}</span>
                      </>
                    }
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger"
                    onClick={() => remove(s.id)}
                    loading={busy === s.id}
                  >
                    Remove<span className="sr-only"> {s.title ?? SCHEDULE_KIND_LABEL[s.kind]}</span>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <ScheduleDialog
        slug={slug}
        schedule={null}
        trigger={<Button variant="secondary" size="sm" className="self-start" />}
        label={
          <>
            <Plus aria-hidden="true" /> Add a time
          </>
        }
      />
    </div>
  );
}
