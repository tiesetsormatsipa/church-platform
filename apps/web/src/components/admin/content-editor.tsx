'use client';

import {
  type AdminContentDetail,
  can,
  CONTENT_TYPE_LABEL,
  type ContentEditorOptions,
  ContentInput,
  contentTarget,
  type ContentType,
  EVENT_CATEGORY_LABEL,
  EventCategory,
} from '@church/shared';
import { Alert } from '@church/ui/alert';
import { Button, buttonVariants } from '@church/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@church/ui/dialog';
import { Field } from '@church/ui/field';
import { Checkbox, Input, NativeSelect, Textarea } from '@church/ui/input';
import { Tabs, TabsList, TabsPanel, TabsTrigger } from '@church/ui/tabs';
import { toast } from '@church/ui/toast';
import { ExternalLink, Lock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { type FieldPath, useForm, useWatch } from 'react-hook-form';
import { Markdown } from '@/components/content/markdown';
import { SubmitButton } from '@/components/forms/submit-button';
import { api, ApiError, ensureOk } from '@/lib/api/client';
import { formatDate } from '@/lib/format';
import { grantsOf, useSession } from '@/lib/hooks/use-session';
import { isoToZonedLocal, zonedLocalToIso } from '@/lib/zoned-time';
import { ContentStatusBadge } from './status-badges';
import {
  type ContentFormValues,
  DEFAULT_TIME_ZONE,
  formPath,
  toFormValues,
  toInput,
} from './content-form';

type Action = 'save' | 'submit' | 'publish' | 'schedule';

const TIMEZONES = [
  'Africa/Johannesburg',
  'Africa/Harare',
  'Africa/Gaborone',
  'Africa/Windhoek',
  'Europe/London',
  'UTC',
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-5 shadow-card">
      <legend className="float-left mb-1 w-full text-base font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

export function ContentEditor({
  type,
  detail,
  options,
}: {
  type: ContentType;
  detail: AdminContentDetail | null;
  options: ContentEditorOptions;
}) {
  const router = useRouter();
  const { user } = useSession();
  const defaultWhere = options.canCreateGlobal ? 'GLOBAL' : (options.branches[0]?.slug ?? '');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Action | 'unpublish' | 'archive' | 'delete' | null>(null);
  const [scheduleAt, setScheduleAt] = useState(
    isoToZonedLocal(detail?.publishedAt, DEFAULT_TIME_ZONE),
  );
  const {
    register,
    handleSubmit,
    setError,
    control,
    reset,
    formState: { errors, isDirty },
  } = useForm<ContentFormValues>({ defaultValues: toFormValues(detail, defaultWhere) });
  const defaults = toFormValues(detail, defaultWhere);
  const field = (name: FieldPath<ContentFormValues>) => ({
    ...register(name),
    defaultValue: String(getPath(defaults, name) ?? ''),
  });
  const errorOf = (name: string) =>
    (getPath(errors, name) as { message?: string } | undefined)?.message;

  const where = useWatch({ control, name: 'where' });
  const isPinned = useWatch({ control, name: 'isPinned' });
  const body = useWatch({ control, name: 'body' });
  const label = CONTENT_TYPE_LABEL[type].singular;
  const target = where === 'GLOBAL' ? contentTarget({ scope: 'GLOBAL', branchId: null }) : null;
  const branchId = options.branches.find((b) => b.slug === where)?.id ?? null;
  const grants = grantsOf(user);
  const canPublish = detail
    ? detail.rights.publish
    : can(
        grants,
        'content.publish',
        target ?? contentTarget({ scope: 'BRANCH', branchId: branchId ?? 'unknown' }),
      );
  const canEdit = detail ? detail.rights.edit : true;
  const scheduled =
    detail?.status === 'PUBLISHED' &&
    detail.publishedAt !== null &&
    new Date(detail.publishedAt) > new Date();

  async function save(values: ContentFormValues): Promise<AdminContentDetail | null> {
    setFormError(null);
    const payload = toInput(type, values);
    const parsed = ContentInput.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        setError(formPath(issue.path.join('.')) as FieldPath<ContentFormValues>, {
          message: issue.message,
        });
      }
      setFormError('Please check the highlighted fields.');
      return null;
    }
    try {
      const saved = detail
        ? ensureOk(
            await api.PUT('/api/v1/admin/content/{id}', {
              params: { path: { id: detail.id } },
              body: parsed.data,
            }),
          )
        : ensureOk(await api.POST('/api/v1/admin/content', { body: parsed.data }));
      reset(toFormValues(saved, defaultWhere));
      return saved;
    } catch (error) {
      if (error instanceof ApiError) {
        for (const e of error.fieldErrors)
          setError(formPath(e.path) as FieldPath<ContentFormValues>, { message: e.message });
        setFormError(
          error.fieldErrors.length ? 'Please check the highlighted fields.' : error.message,
        );
      } else {
        setFormError('We could not reach the server. Check your connection and try again.');
      }
      return null;
    }
  }

  async function run(action: Action, values: ContentFormValues) {
    setBusy(action);
    try {
      const saved = await save(values);
      if (!saved) return;
      let result = saved;
      if (action === 'submit') {
        result = ensureOk(
          await api.POST('/api/v1/admin/content/{id}/submit', {
            params: { path: { id: saved.id } },
          }),
        );
        toast({
          title: 'Submitted for review',
          description: 'A publisher for this branch will look at it.',
          tone: 'success',
        });
      } else if (action === 'publish' || action === 'schedule') {
        const publishAt =
          action === 'schedule' ? zonedLocalToIso(scheduleAt, DEFAULT_TIME_ZONE) : null;
        if (action === 'schedule' && !publishAt) {
          setFormError('Choose when to publish.');
          return;
        }
        result = ensureOk(
          await api.POST('/api/v1/admin/content/{id}/publish', {
            params: { path: { id: saved.id } },
            body: { publishAt },
          }),
        );
        toast({ title: action === 'schedule' ? 'Scheduled' : 'Published', tone: 'success' });
      } else {
        toast({ title: 'Saved', tone: 'success' });
      }
      if (!detail) router.replace(`/admin/content/${result.id}`);
      else router.refresh();
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setBusy(null);
    }
  }

  async function workflow(action: 'unpublish' | 'archive' | 'delete') {
    if (!detail) return;
    setBusy(action);
    try {
      const path = { params: { path: { id: detail.id } } };
      if (action === 'delete') {
        ensureOk(await api.DELETE('/api/v1/admin/content/{id}', path));
        toast({ title: 'Deleted', tone: 'success' });
        router.replace('/admin/content');
        return;
      }
      ensureOk(
        action === 'unpublish'
          ? await api.POST('/api/v1/admin/content/{id}/unpublish', path)
          : await api.POST('/api/v1/admin/content/{id}/archive', path),
      );
      toast({
        title: action === 'unpublish' ? 'Moved back to drafts' : 'Archived',
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

  const submitFor = (action: Action) => handleSubmit((values) => run(action, values));

  return (
    <form
      method="post"
      onSubmit={submitFor('save')}
      noValidate
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]"
    >
      <div className="flex min-w-0 flex-col gap-6">
        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        {!canEdit ? (
          <Alert tone="info" title="Read only">
            You can see this item but not change it. Ask a publisher for this branch.
          </Alert>
        ) : null}

        <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-6">
          <Section title={label}>
            <Field id="content-title" label="Title" error={errorOf('title')}>
              {(props) => (
                <Input {...props} {...field('title')} className="text-base font-medium" />
              )}
            </Field>
            <Field
              id="content-where"
              label="Where it belongs"
              error={errorOf('where')}
              description="Church-wide items appear for every branch."
            >
              {(props) => (
                <NativeSelect {...props} {...field('where')}>
                  {options.canCreateGlobal ? <option value="GLOBAL">Church-wide</option> : null}
                  {options.branches.map((b) => (
                    <option key={b.slug} value={b.slug}>
                      {b.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field
              id="content-summary"
              label="Summary"
              optional
              error={errorOf('summary')}
              description="One or two sentences shown on cards and in search results."
            >
              {(props) => <Textarea {...props} {...field('summary')} rows={2} maxLength={500} />}
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium" id="content-body-label">
                Text
              </span>
              <Tabs defaultValue="write">
                <TabsList aria-labelledby="content-body-label">
                  <TabsTrigger value="write">Write</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>
                <TabsPanel value="write" className="pt-3">
                  <Textarea
                    {...field('body')}
                    aria-labelledby="content-body-label"
                    aria-describedby="content-body-help"
                    rows={14}
                    className="font-mono text-sm"
                  />
                  <p id="content-body-help" className="mt-1.5 text-xs text-muted">
                    Markdown: **bold**, *italic*, [link](https://…), lists with “- ”, headings with
                    “## ”.
                  </p>
                </TabsPanel>
                <TabsPanel value="preview" className="min-h-40 rounded-lg border border-border p-4">
                  {body ? (
                    <Markdown>{body}</Markdown>
                  ) : (
                    <p className="text-sm text-muted">Nothing to preview yet.</p>
                  )}
                </TabsPanel>
              </Tabs>
            </div>
          </Section>

          {type === 'EVENT' ? (
            <Section title="When and where">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="event-starts" label="Starts" error={errorOf('event.starts')}>
                  {(props) => <Input {...props} {...field('event.starts')} type="datetime-local" />}
                </Field>
                <Field id="event-ends" label="Ends" optional error={errorOf('event.ends')}>
                  {(props) => <Input {...props} {...field('event.ends')} type="datetime-local" />}
                </Field>
                <Field id="event-timezone" label="Time zone" error={errorOf('event.timezone')}>
                  {(props) => (
                    <NativeSelect {...props} {...field('event.timezone')}>
                      {TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz.replace('_', ' ')}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                </Field>
                <Field id="event-category" label="Kind of event">
                  {(props) => (
                    <NativeSelect {...props} {...field('event.category')}>
                      {EventCategory.values.map((c) => (
                        <option key={c} value={c}>
                          {c === 'OTHER' ? 'Other' : EVENT_CATEGORY_LABEL[c]}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                </Field>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="event-all-day"
                  {...register('event.allDay')}
                  defaultChecked={defaults.event.allDay}
                  className="mt-0"
                />
                <label htmlFor="event-all-day" className="text-sm">
                  All-day event (times are not shown)
                </label>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="event-venue" label="Venue" optional error={errorOf('event.venueName')}>
                  {(props) => <Input {...props} {...field('event.venueName')} />}
                </Field>
                <Field
                  id="event-address"
                  label="Address"
                  optional
                  error={errorOf('event.venueAddress')}
                >
                  {(props) => (
                    <Input {...props} {...field('event.venueAddress')} autoComplete="off" />
                  )}
                </Field>
                <Field id="event-maps" label="Map link" optional error={errorOf('event.mapsUrl')}>
                  {(props) => (
                    <Input
                      {...props}
                      {...field('event.mapsUrl')}
                      type="url"
                      inputMode="url"
                      placeholder="https://"
                    />
                  )}
                </Field>
                <Field
                  id="event-online"
                  label="Live stream link"
                  optional
                  error={errorOf('event.onlineUrl')}
                >
                  {(props) => (
                    <Input
                      {...props}
                      {...field('event.onlineUrl')}
                      type="url"
                      inputMode="url"
                      placeholder="https://"
                    />
                  )}
                </Field>
                <Field
                  id="event-registration"
                  label="Registration link"
                  optional
                  error={errorOf('event.registrationUrl')}
                >
                  {(props) => (
                    <Input
                      {...props}
                      {...field('event.registrationUrl')}
                      type="url"
                      inputMode="url"
                      placeholder="https://"
                    />
                  )}
                </Field>
                <Field id="event-status" label="Status">
                  {(props) => (
                    <NativeSelect {...props} {...field('event.eventStatus')}>
                      <option value="SCHEDULED">Going ahead</option>
                      <option value="POSTPONED">Postponed</option>
                      <option value="CANCELLED">Cancelled</option>
                    </NativeSelect>
                  )}
                </Field>
              </div>
              <Field
                id="event-status-note"
                label="Note about a change"
                optional
                error={errorOf('event.statusNote')}
              >
                {(props) => (
                  <Input
                    {...props}
                    {...field('event.statusNote')}
                    placeholder="For example: moved to 13 October because of the weather"
                  />
                )}
              </Field>
            </Section>
          ) : null}

          {type === 'SERMON' ? (
            <Section title="Sermon details">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="sermon-date" label="Preached on" error={errorOf('sermon.preachedOn')}>
                  {(props) => <Input {...props} {...field('sermon.preachedOn')} type="date" />}
                </Field>
                <Field
                  id="sermon-scripture"
                  label="Scripture"
                  optional
                  error={errorOf('sermon.scripture')}
                >
                  {(props) => (
                    <Input {...props} {...field('sermon.scripture')} placeholder="John 3:16–21" />
                  )}
                </Field>
                <Field
                  id="sermon-speaker"
                  label="Speaker"
                  optional
                  error={errorOf('sermon.speaker')}
                  description="Not listed? Type the name below."
                >
                  {(props) => (
                    <NativeSelect {...props} {...field('sermon.speaker')}>
                      <option value="">Not listed</option>
                      {options.speakers.map((s) => (
                        <option key={s.slug} value={s.slug}>
                          {s.name}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                </Field>
                <Field
                  id="sermon-speaker-name"
                  label="Speaker name"
                  optional
                  error={errorOf('sermon.speakerName')}
                >
                  {(props) => <Input {...props} {...field('sermon.speakerName')} />}
                </Field>
                <Field id="sermon-series" label="Series" optional error={errorOf('sermon.series')}>
                  {(props) => (
                    <NativeSelect {...props} {...field('sermon.series')}>
                      <option value="">None</option>
                      {options.series.map((s) => (
                        <option key={s.slug} value={s.slug}>
                          {s.title}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                </Field>
                <Field
                  id="sermon-duration"
                  label="Length in minutes"
                  optional
                  error={errorOf('sermon.durationMinutes')}
                >
                  {(props) => (
                    <Input
                      {...props}
                      {...field('sermon.durationMinutes')}
                      type="number"
                      min={0}
                      inputMode="numeric"
                    />
                  )}
                </Field>
                <Field
                  id="sermon-video"
                  label="Video link"
                  optional
                  error={errorOf('sermon.externalVideoUrl')}
                  description="YouTube, Facebook or another site."
                >
                  {(props) => (
                    <Input
                      {...props}
                      {...field('sermon.externalVideoUrl')}
                      type="url"
                      inputMode="url"
                      placeholder="https://"
                    />
                  )}
                </Field>
                <Field id="sermon-language" label="Language" error={errorOf('sermon.language')}>
                  {(props) => (
                    <NativeSelect {...props} {...field('sermon.language')}>
                      <option value="en">English</option>
                      <option value="zu">isiZulu</option>
                      <option value="xh">isiXhosa</option>
                      <option value="st">Sesotho</option>
                      <option value="tn">Setswana</option>
                      <option value="af">Afrikaans</option>
                    </NativeSelect>
                  )}
                </Field>
              </div>
              <Field
                id="sermon-transcript"
                label="Transcript"
                optional
                error={errorOf('sermon.transcript')}
              >
                {(props) => <Textarea {...props} {...field('sermon.transcript')} rows={6} />}
              </Field>
            </Section>
          ) : null}

          {type === 'BAPTISM' ? (
            <Section title="Baptism details">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  id="baptism-date"
                  label="Date"
                  optional
                  error={errorOf('baptism.baptismDate')}
                >
                  {(props) => <Input {...props} {...field('baptism.baptismDate')} type="date" />}
                </Field>
                <Field
                  id="baptism-count"
                  label="Number baptised"
                  optional
                  error={errorOf('baptism.candidatesCount')}
                >
                  {(props) => (
                    <Input
                      {...props}
                      {...field('baptism.candidatesCount')}
                      type="number"
                      min={0}
                      inputMode="numeric"
                    />
                  )}
                </Field>
                <Field
                  id="baptism-officiant"
                  label="Officiated by"
                  optional
                  error={errorOf('baptism.officiantName')}
                >
                  {(props) => <Input {...props} {...field('baptism.officiantName')} />}
                </Field>
                <Field
                  id="baptism-location"
                  label="Place"
                  optional
                  error={errorOf('baptism.location')}
                >
                  {(props) => <Input {...props} {...field('baptism.location')} />}
                </Field>
              </div>
            </Section>
          ) : null}

          <details className="rounded-xl border border-border bg-surface p-5 shadow-card">
            <summary className="cursor-pointer font-semibold">More options</summary>
            <div className="mt-5 flex flex-col gap-5">
              <Field
                id="content-tags"
                label="Topics"
                optional
                error={errorOf('tags')}
                description="Separate with commas, for example: Youth, Choir."
              >
                {(props) => <Input {...props} {...field('tags')} />}
              </Field>
              <Field
                id="content-author"
                label="Shown as written by"
                optional
                error={errorOf('authorName')}
                description="Leave empty to use your name."
              >
                {(props) => <Input {...props} {...field('authorName')} />}
              </Field>
              <Field
                id="content-slug"
                label="Web address"
                optional
                error={errorOf('slug')}
                description={
                  detail?.slugLocked
                    ? 'Fixed after publishing, so shared links keep working.'
                    : 'Made from the title if left empty.'
                }
              >
                {(props) => (
                  <div className="relative">
                    <Input
                      {...props}
                      {...field('slug')}
                      readOnly={detail?.slugLocked}
                      className={detail?.slugLocked ? 'pr-9' : undefined}
                    />
                    {detail?.slugLocked ? (
                      <Lock
                        aria-hidden="true"
                        className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted"
                      />
                    ) : null}
                  </div>
                )}
              </Field>
              <Field
                id="content-seo-title"
                label="Search engine title"
                optional
                error={errorOf('seoTitle')}
              >
                {(props) => <Input {...props} {...field('seoTitle')} />}
              </Field>
              <Field
                id="content-seo-description"
                label="Search engine description"
                optional
                error={errorOf('seoDescription')}
              >
                {(props) => (
                  <Textarea {...props} {...field('seoDescription')} rows={2} maxLength={300} />
                )}
              </Field>
            </div>
          </details>
        </fieldset>
      </div>

      <aside
        className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start"
        aria-label="Publishing"
      >
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">Status</span>
            {detail ? (
              <ContentStatusBadge status={detail.status} scheduled={scheduled} />
            ) : (
              <span className="text-sm text-muted">New</span>
            )}
          </div>
          {detail?.publishedAt ? (
            <p className="text-xs text-muted">
              {scheduled ? 'Goes live' : 'Published'} {formatDate(detail.publishedAt)}
            </p>
          ) : null}
          {detail?.status === 'PUBLISHED' && !scheduled ? (
            <Link
              href={detail.path}
              target="_blank"
              className={buttonVariants({
                variant: 'ghost',
                size: 'sm',
                className: 'justify-start',
              })}
            >
              <ExternalLink aria-hidden="true" /> View on the site
            </Link>
          ) : null}

          {canEdit ? (
            <div className="flex flex-col gap-2">
              <SubmitButton
                variant="secondary"
                loading={busy === 'save'}
                disabled={busy !== null || (detail !== null && !isDirty)}
              >
                {detail ? 'Save changes' : 'Save draft'}
              </SubmitButton>
              {canPublish ? (
                <Button
                  type="button"
                  onClick={submitFor('publish')}
                  loading={busy === 'publish'}
                  disabled={busy !== null}
                >
                  {detail?.status === 'PUBLISHED' ? 'Save and update' : 'Publish now'}
                </Button>
              ) : detail?.status !== 'PENDING_REVIEW' ? (
                <Button
                  type="button"
                  onClick={submitFor('submit')}
                  loading={busy === 'submit'}
                  disabled={busy !== null}
                >
                  Submit for review
                </Button>
              ) : (
                <p className="text-xs text-muted">Waiting for a publisher to review it.</p>
              )}
            </div>
          ) : null}

          {canEdit && canPublish && detail?.status !== 'PUBLISHED' ? (
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <label htmlFor="schedule-at" className="text-sm font-medium">
                Publish later
              </label>
              <Input
                id="schedule-at"
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={submitFor('schedule')}
                loading={busy === 'schedule'}
                disabled={busy !== null || !scheduleAt}
              >
                Schedule
              </Button>
              <p className="text-xs text-muted">Times are South African (SAST).</p>
            </div>
          ) : null}
        </div>

        {canPublish && canEdit ? (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-card">
            <span className="text-sm font-semibold">Highlight</span>
            <div className="flex items-start gap-2">
              <Checkbox
                id="content-pinned"
                {...register('isPinned')}
                defaultChecked={defaults.isPinned}
              />
              <label htmlFor="content-pinned" className="text-sm">
                Pin to the top as “Important”
              </label>
            </div>
            {isPinned ? (
              <Field
                id="content-pinned-until"
                label="Until"
                optional
                error={errorOf('pinnedUntil')}
              >
                {(props) => <Input {...props} {...field('pinnedUntil')} type="datetime-local" />}
              </Field>
            ) : null}
            {type === 'EVENT' ? (
              <div className="flex items-start gap-2">
                <Checkbox
                  id="content-featured"
                  {...register('isFeatured')}
                  defaultChecked={defaults.isFeatured}
                />
                <label htmlFor="content-featured" className="text-sm">
                  Feature on the home page with a countdown
                </label>
              </div>
            ) : null}
          </div>
        ) : null}

        {detail && (detail.rights.publish || detail.rights.archive || detail.rights.edit) ? (
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-5 shadow-card">
            {detail.rights.publish && detail.status === 'PUBLISHED' ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => workflow('unpublish')}
                loading={busy === 'unpublish'}
              >
                Move back to drafts
              </Button>
            ) : null}
            {detail.rights.archive && detail.status !== 'ARCHIVED' ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => workflow('archive')}
                loading={busy === 'archive'}
              >
                Archive
              </Button>
            ) : null}
            {detail.rights.archive || (detail.rights.edit && detail.status === 'DRAFT') ? (
              <Dialog>
                <DialogTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="justify-start text-danger"
                    />
                  }
                >
                  Delete…
                </DialogTrigger>
                <DialogContent
                  title={`Delete “${detail.title}”?`}
                  description="It disappears from the site and from this list. This cannot be undone here."
                >
                  <div className="flex justify-end gap-2 pt-2">
                    <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
                    <Button
                      variant="danger"
                      onClick={() => workflow('delete')}
                      loading={busy === 'delete'}
                    >
                      Delete
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            ) : null}
            <p className="pt-1 text-xs text-subtle">
              {detail.createdBy ? `Created by ${detail.createdBy}` : 'Created'} ·{' '}
              {formatDate(detail.createdAt)}
              {detail.updatedBy ? ` · last edited by ${detail.updatedBy}` : ''}
            </p>
          </div>
        ) : null}
      </aside>
    </form>
  );
}

function getPath(source: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined,
      source,
    );
}
