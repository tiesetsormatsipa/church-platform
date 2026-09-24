/**
 * Administration of content: listing (all statuses), the editor form, workflow actions and
 * the lookups the editor needs. Public read contracts are in `public.ts`.
 */
import { z } from 'zod';
import {
  HttpUrl,
  IsoDate,
  IsoDateTime,
  OffsetPageQuery,
  offsetPage,
  optionalText,
  Slug,
  text,
  Uuid,
} from '../common.js';
import { ContentScope, ContentStatus, ContentType, EventCategory, EventStatus } from '../enums.js';
import { BranchRef } from './auth.js';

export const ContentRightsDto = z.object({
  edit: z.boolean(),
  submit: z.boolean(),
  publish: z.boolean(),
  archive: z.boolean(),
});

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

export const AdminContentQuery = OffsetPageQuery.extend({
  status: ContentStatus.schema.optional(),
  type: ContentType.schema.optional(),
  /** Branch slug, or `global` for church-wide content. */
  branch: z.union([z.literal('global'), Slug]).optional(),
  q: z.string().trim().max(100).optional(),
  /** Only items created by the current user. */
  mine: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type AdminContentQuery = z.input<typeof AdminContentQuery>;

export const AdminContentRow = z
  .object({
    id: Uuid,
    type: ContentType.schema,
    slug: z.string(),
    path: z.string(),
    title: z.string(),
    status: ContentStatus.schema,
    scope: ContentScope.schema,
    branch: BranchRef.nullable(),
    /** Publication time; in the future when scheduled. */
    publishedAt: IsoDateTime.nullable(),
    updatedAt: IsoDateTime,
    createdBy: z.string().nullable(),
    isPinned: z.boolean(),
    isFeatured: z.boolean(),
    eventStartsAt: IsoDateTime.nullable(),
    rights: ContentRightsDto,
  })
  .meta({ id: 'AdminContentRow' });
export type AdminContentRow = z.infer<typeof AdminContentRow>;

export const AdminContentList = offsetPage(AdminContentRow).meta({ id: 'AdminContentList' });
export type AdminContentList = z.infer<typeof AdminContentList>;

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

export const EventInput = z
  .object({
    startsAt: IsoDateTime,
    endsAt: IsoDateTime.nullable().default(null),
    allDay: z.boolean().default(false),
    timezone: z.string().min(1).max(64).default('Africa/Johannesburg'),
    category: EventCategory.schema.default('OTHER'),
    eventStatus: EventStatus.schema.default('SCHEDULED'),
    statusNote: optionalText(300),
    venueName: optionalText(200),
    venueAddress: optionalText(300),
    mapsUrl: HttpUrl.nullable().optional(),
    onlineUrl: HttpUrl.nullable().optional(),
    registrationUrl: HttpUrl.nullable().optional(),
  })
  .refine((e) => !e.endsAt || new Date(e.endsAt) >= new Date(e.startsAt), {
    path: ['endsAt'],
    error: 'The end must be after the start',
  });

export const SermonInput = z.object({
  preachedOn: IsoDate,
  /** Slug of an existing speaker; otherwise use `speakerName`. */
  speaker: Slug.nullable().optional(),
  speakerName: optionalText(120),
  series: Slug.nullable().optional(),
  scripture: optionalText(300),
  externalVideoUrl: HttpUrl.nullable().optional(),
  durationSeconds: z.number().int().min(0).max(86_400).nullable().optional(),
  language: z.string().min(2).max(16).default('en'),
  transcript: optionalText(200_000),
});

export const BaptismInput = z.object({
  baptismDate: IsoDate.nullable().optional(),
  candidatesCount: z.number().int().min(0).max(10_000).nullable().optional(),
  officiantName: optionalText(120),
  location: optionalText(200),
});

const DETAIL_FOR: Partial<Record<ContentType, 'event' | 'sermon' | 'baptism'>> = {
  EVENT: 'event',
  SERMON: 'sermon',
};

/** Everything the editor saves. Workflow (status) changes use separate actions. */
export const ContentInput = z
  .object({
    type: ContentType.schema,
    scope: ContentScope.schema,
    /** Branch slug; required for branch content, null for church-wide content. */
    branch: Slug.nullable(),
    title: text(200),
    /** Generated from the title when omitted. Locked once the item has been published. */
    slug: Slug.optional(),
    summary: optionalText(500),
    body: optionalText(100_000),
    authorName: optionalText(120),
    isPinned: z.boolean().default(false),
    pinnedUntil: IsoDateTime.nullable().optional(),
    isFeatured: z.boolean().default(false),
    seoTitle: optionalText(200),
    seoDescription: optionalText(300),
    tags: z.array(text(40)).max(10).default([]),
    event: EventInput.nullable().optional(),
    sermon: SermonInput.nullable().optional(),
    baptism: BaptismInput.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.scope === 'BRANCH' && !value.branch) {
      ctx.addIssue({ code: 'custom', path: ['branch'], message: 'Choose the branch' });
    }
    if (value.scope === 'GLOBAL' && value.branch) {
      ctx.addIssue({
        code: 'custom',
        path: ['branch'],
        message: 'Church-wide content has no branch',
      });
    }
    const required = DETAIL_FOR[value.type];
    if (required && !value[required]) {
      ctx.addIssue({
        code: 'custom',
        path: [required],
        message: required === 'event' ? 'Add the event date and time' : 'Add the sermon details',
      });
    }
  })
  .meta({ id: 'ContentInput' });
export type ContentInput = z.input<typeof ContentInput>;

export const AdminContentDetail = z
  .object({
    id: Uuid,
    type: ContentType.schema,
    scope: ContentScope.schema,
    branch: BranchRef.nullable(),
    slug: z.string(),
    slugLocked: z.boolean(),
    path: z.string(),
    title: z.string(),
    summary: z.string().nullable(),
    body: z.string().nullable(),
    authorName: z.string().nullable(),
    status: ContentStatus.schema,
    publishedAt: IsoDateTime.nullable(),
    isPinned: z.boolean(),
    pinnedUntil: IsoDateTime.nullable(),
    isFeatured: z.boolean(),
    seoTitle: z.string().nullable(),
    seoDescription: z.string().nullable(),
    tags: z.array(z.string()),
    event: z
      .object({
        startsAt: IsoDateTime,
        endsAt: IsoDateTime.nullable(),
        allDay: z.boolean(),
        timezone: z.string(),
        category: EventCategory.schema,
        eventStatus: EventStatus.schema,
        statusNote: z.string().nullable(),
        venueName: z.string().nullable(),
        venueAddress: z.string().nullable(),
        mapsUrl: z.string().nullable(),
        onlineUrl: z.string().nullable(),
        registrationUrl: z.string().nullable(),
      })
      .nullable(),
    sermon: z
      .object({
        preachedOn: IsoDate,
        speaker: z.string().nullable(),
        speakerName: z.string().nullable(),
        series: z.string().nullable(),
        scripture: z.string().nullable(),
        externalVideoUrl: z.string().nullable(),
        durationSeconds: z.number().int().nullable(),
        language: z.string(),
        transcript: z.string().nullable(),
      })
      .nullable(),
    baptism: z
      .object({
        baptismDate: IsoDate.nullable(),
        candidatesCount: z.number().int().nullable(),
        officiantName: z.string().nullable(),
        location: z.string().nullable(),
      })
      .nullable(),
    createdBy: z.string().nullable(),
    updatedBy: z.string().nullable(),
    createdAt: IsoDateTime,
    updatedAt: IsoDateTime,
    rights: ContentRightsDto,
  })
  .meta({ id: 'AdminContentDetail' });
export type AdminContentDetail = z.infer<typeof AdminContentDetail>;

export const PublishRequest = z
  .object({
    /** Schedule for later; publishes immediately when omitted or in the past. */
    publishAt: IsoDateTime.nullable().optional(),
  })
  .meta({ id: 'PublishRequest' });
export type PublishRequest = z.input<typeof PublishRequest>;

// ---------------------------------------------------------------------------
// Lookups for the editor
// ---------------------------------------------------------------------------

export const ContentEditorOptions = z
  .object({
    /** Whether the user may create church-wide content. */
    canCreateGlobal: z.boolean(),
    /** Branches the user may create content for. */
    branches: z.array(BranchRef),
    speakers: z.array(z.object({ slug: z.string(), name: z.string() })),
    series: z.array(z.object({ slug: z.string(), title: z.string() })),
    tags: z.array(z.string()),
  })
  .meta({ id: 'ContentEditorOptions' });
export type ContentEditorOptions = z.infer<typeof ContentEditorOptions>;

export const SpeakerInput = z
  .object({ name: text(120), title: optionalText(120) })
  .meta({ id: 'SpeakerInput' });
export const SeriesInput = z
  .object({ title: text(200), description: optionalText(2000) })
  .meta({ id: 'SeriesInput' });
export const SlugRef = z.object({ slug: z.string(), name: z.string() }).meta({ id: 'SlugRef' });
