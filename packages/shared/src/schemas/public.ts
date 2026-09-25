/**
 * Public read contracts: organisation, branches, content (feed, events, news, sermons,
 * baptism) and search. Responses never include drafts, internal notes or personal data
 * beyond display names.
 */
import { z } from 'zod';
import { CursorPageQuery, IsoDate, IsoDateTime, Slug, Uuid } from '../common.js';
import {
  BranchType,
  ContentCollection,
  ContentScope,
  ContentType,
  EventCategory,
  EventStatus,
  ScheduleKind,
  type ContentType as ContentTypeValue,
} from '../enums.js';
import { BranchRef } from './auth.js';

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

export const ImageDto = z.object({
  id: Uuid,
  url: z.string(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  alt: z.string().nullable(),
  placeholderColor: z.string().nullable(),
  sources: z.array(
    z.object({
      url: z.string(),
      width: z.number().int().nullable(),
      height: z.number().int().nullable(),
    }),
  ),
});
export type ImageDto = z.infer<typeof ImageDto>;

export const TagDto = z.object({ slug: z.string(), name: z.string() });
export type TagDto = z.infer<typeof TagDto>;

/** Canonical app path for a content item. */
export function contentPath(type: ContentTypeValue, slug: string): string {
  switch (type) {
    case 'EVENT':
      return `/events/${slug}`;
    case 'NEWS':
      return `/news/${slug}`;
    case 'SERMON':
      return `/sermons/${slug}`;
    default:
      return `/posts/${slug}`;
  }
}

// ---------------------------------------------------------------------------
// Organisation
// ---------------------------------------------------------------------------

export const PublicOrganization = z
  .object({
    name: z.string(),
    shortName: z.string().nullable(),
    tagline: z.string().nullable(),
    description: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    websiteUrl: z.string().nullable(),
    timezone: z.string(),
    locale: z.string(),
    logo: ImageDto.nullable(),
    registrationOpen: z.boolean(),
    socialLinks: z.record(z.string(), z.string()),
  })
  .meta({ id: 'PublicOrganization' });
export type PublicOrganization = z.infer<typeof PublicOrganization>;

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------

export const ScheduleDto = z.object({
  id: Uuid,
  kind: ScheduleKind.schema,
  title: z.string().nullable(),
  dayOfWeek: z.number().int().min(0).max(6).nullable(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  recurrenceText: z.string().nullable(),
  notes: z.string().nullable(),
  effectiveFrom: IsoDate.nullable(),
  effectiveUntil: IsoDate.nullable(),
  replacesRegular: z.boolean(),
});
export type ScheduleDto = z.infer<typeof ScheduleDto>;

export const LeaderDto = z.object({
  id: Uuid,
  name: z.string(),
  title: z.string(),
  bio: z.string().nullable(),
  photo: ImageDto.nullable(),
});
export type LeaderDto = z.infer<typeof LeaderDto>;

export const BranchSummary = z
  .object({
    id: Uuid,
    slug: z.string(),
    name: z.string(),
    type: BranchType.schema,
    city: z.string().nullable(),
    province: z.string().nullable(),
    countryCode: z.string(),
    cover: ImageDto.nullable(),
    /** Regular weekly services currently in effect (for cards). */
    services: z.array(ScheduleDto),
    hasTemporaryChanges: z.boolean(),
  })
  .meta({ id: 'BranchSummary' });
export type BranchSummary = z.infer<typeof BranchSummary>;

export const BranchList = z.object({ items: z.array(BranchSummary) }).meta({ id: 'BranchList' });

export const BranchDetail = BranchSummary.extend({
  description: z.string().nullable(),
  addressLine1: z.string().nullable(),
  addressLine2: z.string().nullable(),
  postalCode: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  mapsUrl: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  parent: BranchRef.nullable(),
  subBranches: z.array(BranchRef),
  /** Everything in effect today, temporary replacements applied. */
  schedules: z.array(ScheduleDto),
  /** Temporary changes in effect today or starting later. */
  temporaryChanges: z.array(ScheduleDto),
  leaders: z.array(LeaderDto),
  gallery: z.array(ImageDto.extend({ caption: z.string().nullable() })),
}).meta({ id: 'BranchDetail' });
export type BranchDetail = z.infer<typeof BranchDetail>;

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

export const EventSummaryDto = z.object({
  startsAt: IsoDateTime,
  endsAt: IsoDateTime.nullable(),
  allDay: z.boolean(),
  timezone: z.string(),
  category: EventCategory.schema,
  eventStatus: EventStatus.schema,
  venueName: z.string().nullable(),
});

export const SermonSummaryDto = z.object({
  preachedOn: IsoDate,
  speakerName: z.string().nullable(),
  speakerSlug: z.string().nullable(),
  seriesTitle: z.string().nullable(),
  seriesSlug: z.string().nullable(),
  scripture: z.string().nullable(),
  durationSeconds: z.number().int().nullable(),
  hasAudio: z.boolean(),
  hasVideo: z.boolean(),
});

/** A song as the library and the player need it. */
export const SongSummaryDto = z.object({
  artist: z.string().nullable(),
  album: z.string().nullable(),
  trackNumber: z.number().int().nullable(),
  durationSeconds: z.number().int().nullable(),
  language: z.string(),
  recordedOn: IsoDate.nullable(),
  /** Where the player streams from; null until the audio is uploaded. */
  audioUrl: z.string().nullable(),
});

export const BaptismSummaryDto = z.object({
  baptismDate: IsoDate.nullable(),
  candidatesCount: z.number().int().nullable(),
});

export const ContentSummary = z
  .object({
    id: Uuid,
    type: ContentType.schema,
    slug: z.string(),
    path: z.string(),
    title: z.string(),
    summary: z.string(),
    scope: ContentScope.schema,
    branch: BranchRef.nullable(),
    publishedAt: IsoDateTime,
    isPinned: z.boolean(),
    isFeatured: z.boolean(),
    cover: ImageDto.nullable(),
    authorName: z.string().nullable(),
    tags: z.array(TagDto),
    event: EventSummaryDto.nullable(),
    sermon: SermonSummaryDto.nullable(),
    song: SongSummaryDto.nullable(),
    baptism: BaptismSummaryDto.nullable(),
    collection: ContentCollection.schema,
  })
  .meta({ id: 'ContentSummary' });
export type ContentSummary = z.infer<typeof ContentSummary>;

export const MediaSourceDto = z.object({
  url: z.string(),
  mimeType: z.string(),
  durationSeconds: z.number().int().nullable(),
  posterUrl: z.string().nullable(),
});
export type MediaSourceDto = z.infer<typeof MediaSourceDto>;

export const ContentDetail = ContentSummary.extend({
  body: z.string().nullable(),
  bodyFormat: z.literal('MARKDOWN'),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  updatedAt: IsoDateTime,
  gallery: z.array(ImageDto.extend({ caption: z.string().nullable() })),
  eventDetail: EventSummaryDto.extend({
    statusNote: z.string().nullable(),
    venueAddress: z.string().nullable(),
    mapsUrl: z.string().nullable(),
    onlineUrl: z.string().nullable(),
    registrationUrl: z.string().nullable(),
  }).nullable(),
  sermonDetail: SermonSummaryDto.extend({
    speaker: z
      .object({ slug: z.string(), name: z.string(), title: z.string().nullable() })
      .nullable(),
    series: z.object({ slug: z.string(), title: z.string() }).nullable(),
    audio: MediaSourceDto.nullable(),
    video: MediaSourceDto.nullable(),
    externalVideoUrl: z.string().nullable(),
    language: z.string(),
    transcript: z.string().nullable(),
  }).nullable(),
  songDetail: SongSummaryDto.extend({
    lyrics: z.string().nullable(),
  }).nullable(),
  baptismDetail: BaptismSummaryDto.extend({
    officiantName: z.string().nullable(),
    location: z.string().nullable(),
  }).nullable(),
  related: z.array(ContentSummary),
}).meta({ id: 'ContentDetail' });
export type ContentDetail = z.infer<typeof ContentDetail>;

export const ContentPage = z
  .object({ items: z.array(ContentSummary), nextCursor: z.string().nullable() })
  .meta({ id: 'ContentPage' });
export type ContentPage = z.infer<typeof ContentPage>;

/** Which part of the context to show: everything, church-wide only, or branch content only. */
export const ScopeFilter = z.enum(['all', 'global', 'branch']);
export type ScopeFilter = z.infer<typeof ScopeFilter>;

const typeList = z
  .string()
  .max(200)
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
  )
  .pipe(z.array(ContentType.schema).max(6));

export const ContentQuery = CursorPageQuery.extend({
  branch: Slug.optional(),
  types: typeList.optional(),
  scope: ScopeFilter.default('all'),
  tag: Slug.optional(),
});
export type ContentQuery = z.infer<typeof ContentQuery>;

export const EventsQuery = CursorPageQuery.extend({
  branch: Slug.optional(),
  scope: ScopeFilter.default('all'),
  when: z.enum(['upcoming', 'past']).default('upcoming'),
  category: EventCategory.schema.optional(),
});
export type EventsQuery = z.infer<typeof EventsQuery>;

/**
 * Filters shared by the sermon and song libraries.
 *
 * `country` and `branch` choose whose material you are looking at without changing where you
 * belong: the country you chose feeds you first, and you can look anywhere else, or at
 * everything, from the same page. `collection` separates Truth of God and the Holy
 * Convocation from the branches' own material.
 */
const MediaFilters = {
  branch: Slug.optional(),
  /** ISO 3166-1 alpha-2, or "all". Ignored when `branch` names one. */
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^([A-Z]{2}|ALL)$/, 'Use a two-letter country code')
    .optional(),
  collection: ContentCollection.schema.optional(),
  language: z.string().trim().toLowerCase().max(16).optional(),
  /** Inclusive range; either end may be given on its own. */
  from: IsoDate.optional(),
  until: IsoDate.optional(),
  /** Convenience for "just this year" or "just this month" (1–12, needs `year`). */
  year: z.coerce.number().int().min(1900).max(2999).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  tag: Slug.optional(),
  q: z.string().trim().max(100).optional(),
} as const;

export const SermonsQuery = CursorPageQuery.extend({
  ...MediaFilters,
  scope: ScopeFilter.default('all'),
  speaker: Slug.optional(),
  series: Slug.optional(),
});
export type SermonsQuery = z.infer<typeof SermonsQuery>;

export const SongsQuery = CursorPageQuery.extend({
  ...MediaFilters,
  scope: ScopeFilter.default('all'),
  album: z.string().trim().max(200).optional(),
});
export type SongsQuery = z.infer<typeof SongsQuery>;

export const SpeakerDto = z.object({
  slug: z.string(),
  name: z.string(),
  title: z.string().nullable(),
  sermonCount: z.number().int(),
});
export const SeriesDto = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  sermonCount: z.number().int(),
});
export const MediaFacetsDto = z.object({
  languages: z.array(z.object({ code: z.string(), name: z.string(), count: z.number().int() })),
  collections: z.array(
    z.object({ value: ContentCollection.schema, label: z.string(), count: z.number().int() }),
  ),
  countries: z.array(z.object({ code: z.string(), name: z.string(), count: z.number().int() })),
  years: z.array(z.object({ year: z.number().int(), count: z.number().int() })),
});
export type MediaFacetsDto = z.infer<typeof MediaFacetsDto>;

export const SongsPage = z
  .object({
    items: z.array(ContentSummary),
    nextCursor: z.string().nullable(),
    facets: MediaFacetsDto,
    albums: z.array(z.object({ name: z.string(), count: z.number().int() })),
  })
  .meta({ id: 'SongsPage' });
export type SongsPage = z.infer<typeof SongsPage>;

export const SermonFacets = z
  .object({ speakers: z.array(SpeakerDto), series: z.array(SeriesDto), tags: z.array(TagDto) })
  .meta({ id: 'SermonFacets' });
export type SermonFacets = z.infer<typeof SermonFacets>;

export const HomeQuery = z.object({ branch: Slug.optional() });

export const HomeResponse = z
  .object({
    branch: BranchSummary.nullable(),
    featuredEvent: ContentSummary.nullable(),
    pinned: z.array(ContentSummary),
    upcomingEvents: z.array(ContentSummary),
    latest: z.array(ContentSummary),
    latestSermon: ContentSummary.nullable(),
    news: z.array(ContentSummary),
  })
  .meta({ id: 'HomeResponse' });
export type HomeResponse = z.infer<typeof HomeResponse>;

export const SearchQuery = z.object({
  q: z.string().trim().min(2).max(100),
  branch: Slug.optional(),
  types: typeList.optional(),
  limit: z.coerce.number().int().min(1).max(30).default(20),
});
export type SearchQuery = z.infer<typeof SearchQuery>;

export const SearchResponse = z
  .object({
    query: z.string(),
    content: z.array(ContentSummary),
    branches: z.array(BranchRef),
  })
  .meta({ id: 'SearchResponse' });
export type SearchResponse = z.infer<typeof SearchResponse>;

// ---------------------------------------------------------------------------
// Links: legacy URL resolution and sitemap
// ---------------------------------------------------------------------------

/** Kinds of legacy id the site can resolve to a new URL (see DATA_MIGRATION.md §4). */
export const LegacyEntity = z.enum(['branch', 'content']);
export type LegacyEntity = z.infer<typeof LegacyEntity>;

/** `legacy_id_map.entity_type` used by the importer for each resolvable kind. */
export const LEGACY_ENTITY_TYPE: Record<LegacyEntity, string> = {
  branch: 'branch',
  content: 'content_item',
};

export const LegacyLink = z.object({ path: z.string() }).meta({ id: 'LegacyLink' });
export type LegacyLink = z.infer<typeof LegacyLink>;

export const SitemapEntry = z.object({ path: z.string(), updatedAt: IsoDateTime });
export const SitemapResponse = z
  .object({ content: z.array(SitemapEntry), branches: z.array(SitemapEntry) })
  .meta({ id: 'SitemapResponse' });
export type SitemapResponse = z.infer<typeof SitemapResponse>;
