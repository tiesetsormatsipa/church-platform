import type { Prisma } from '@church/database';

const personName = {
  select: { profile: { select: { firstName: true, lastName: true, displayName: true } } },
} as const;

export const ADMIN_CONTENT_ROW_SELECT = {
  id: true,
  type: true,
  slug: true,
  title: true,
  status: true,
  scope: true,
  branchId: true,
  publishedAt: true,
  updatedAt: true,
  isPinned: true,
  isFeatured: true,
  createdById: true,
  createdBy: personName,
  branch: { select: { id: true, slug: true, name: true } },
  event: { select: { startsAt: true } },
} satisfies Prisma.ContentItemSelect;

export type AdminContentRowData = Prisma.ContentItemGetPayload<{
  select: typeof ADMIN_CONTENT_ROW_SELECT;
}>;

export const ADMIN_CONTENT_DETAIL_SELECT = {
  ...ADMIN_CONTENT_ROW_SELECT,
  summary: true,
  body: true,
  authorName: true,
  pinnedUntil: true,
  seoTitle: true,
  seoDescription: true,
  createdAt: true,
  updatedBy: personName,
  tags: { select: { tag: { select: { name: true } } }, orderBy: { tag: { name: 'asc' } } },
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
      externalVideoUrl: true,
      durationSeconds: true,
      language: true,
      transcript: true,
      speaker: { select: { slug: true } },
      series: { select: { slug: true } },
    },
  },
  baptism: {
    select: { baptismDate: true, candidatesCount: true, officiantName: true, location: true },
  },
} satisfies Prisma.ContentItemSelect;

export type AdminContentDetailData = Prisma.ContentItemGetPayload<{
  select: typeof ADMIN_CONTENT_DETAIL_SELECT;
}>;

export function displayName(
  person: {
    profile: { firstName: string; lastName: string; displayName: string | null } | null;
  } | null,
): string | null {
  const profile = person?.profile;
  if (!profile) return null;
  return profile.displayName || `${profile.firstName} ${profile.lastName}`.trim() || null;
}
