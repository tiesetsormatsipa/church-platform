import type { Prisma } from '@church/database';
import { MEDIA_URL_SELECT } from '../core/media-urls.service.js';

const BRANCH_REF = { select: { id: true, slug: true, name: true } } as const;

/** Columns needed to render a content card. */
export const CONTENT_SUMMARY_SELECT = {
  id: true,
  type: true,
  slug: true,
  title: true,
  summary: true,
  body: true,
  scope: true,
  publishedAt: true,
  isPinned: true,
  pinnedUntil: true,
  isFeatured: true,
  authorName: true,
  coverAlt: true,
  branch: BRANCH_REF,
  coverMedia: { select: MEDIA_URL_SELECT },
  author: { select: { profile: { select: { firstName: true, lastName: true, displayName: true } } } },
  tags: { select: { tag: { select: { slug: true, name: true } } } },
  event: {
    select: {
      startsAt: true,
      endsAt: true,
      allDay: true,
      timezone: true,
      category: true,
      eventStatus: true,
      venueName: true,
    },
  },
  sermon: {
    select: {
      preachedOn: true,
      speakerName: true,
      scripture: true,
      durationSeconds: true,
      audioMediaId: true,
      videoMediaId: true,
      externalVideoUrl: true,
      speaker: { select: { slug: true, name: true } },
      series: { select: { slug: true, title: true } },
    },
  },
  baptism: { select: { baptismDate: true, candidatesCount: true } },
} as const satisfies Prisma.ContentItemSelect;

const MEDIA_SOURCE_SELECT = {
  id: true,
  storageKey: true,
  visibility: true,
  status: true,
  mimeType: true,
  durationSeconds: true,
  variants: { select: { name: true, storageKey: true, mimeType: true, width: true, height: true } },
} as const;

/** Everything needed to render a content page. */
export const CONTENT_DETAIL_SELECT = {
  ...CONTENT_SUMMARY_SELECT,
  body: true,
  bodyFormat: true,
  seoTitle: true,
  seoDescription: true,
  updatedAt: true,
  branchId: true,
  media: {
    select: { caption: true, sortOrder: true, media: { select: MEDIA_URL_SELECT } },
    orderBy: { sortOrder: 'asc' },
  },
  event: {
    select: {
      startsAt: true,
      endsAt: true,
      allDay: true,
      timezone: true,
      category: true,
      eventStatus: true,
      statusNote: true,
      venueName: true,
      venueAddress: true,
      mapsUrl: true,
      onlineUrl: true,
      registrationUrl: true,
    },
  },
  sermon: {
    select: {
      preachedOn: true,
      speakerName: true,
      scripture: true,
      durationSeconds: true,
      audioMediaId: true,
      videoMediaId: true,
      externalVideoUrl: true,
      language: true,
      transcript: true,
      speaker: { select: { slug: true, name: true, title: true } },
      series: { select: { slug: true, title: true } },
      audioMedia: { select: MEDIA_SOURCE_SELECT },
      videoMedia: { select: MEDIA_SOURCE_SELECT },
    },
  },
  baptism: { select: { baptismDate: true, candidatesCount: true, officiantName: true, location: true } },
} as const satisfies Prisma.ContentItemSelect;

export type ContentSummaryRow = Prisma.ContentItemGetPayload<{ select: typeof CONTENT_SUMMARY_SELECT }>;
export type ContentDetailRow = Prisma.ContentItemGetPayload<{ select: typeof CONTENT_DETAIL_SELECT }>;
