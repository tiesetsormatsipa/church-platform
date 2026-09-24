import type { AdminContentDetail, ContentInput, ContentType } from '@church/shared';
import { isoToZonedLocal, zonedLocalToIso } from '@/lib/zoned-time';

export const DEFAULT_TIME_ZONE = 'Africa/Johannesburg';

/** Flat, string-based values for the editor inputs. */
export interface ContentFormValues {
  title: string;
  slug: string;
  /** "GLOBAL" or a branch slug. */
  where: string;
  summary: string;
  body: string;
  authorName: string;
  tags: string;
  isPinned: boolean;
  pinnedUntil: string;
  isFeatured: boolean;
  seoTitle: string;
  seoDescription: string;
  event: {
    starts: string;
    ends: string;
    allDay: boolean;
    timezone: string;
    category: string;
    eventStatus: string;
    statusNote: string;
    venueName: string;
    venueAddress: string;
    mapsUrl: string;
    onlineUrl: string;
    registrationUrl: string;
  };
  sermon: {
    preachedOn: string;
    speaker: string;
    speakerName: string;
    series: string;
    scripture: string;
    externalVideoUrl: string;
    durationMinutes: string;
    language: string;
    transcript: string;
  };
  baptism: {
    baptismDate: string;
    candidatesCount: string;
    officiantName: string;
    location: string;
  };
}

export function toFormValues(detail: AdminContentDetail | null, defaultWhere: string): ContentFormValues {
  const tz = detail?.event?.timezone ?? DEFAULT_TIME_ZONE;
  return {
    title: detail?.title ?? '',
    slug: detail?.slug ?? '',
    where: detail ? (detail.scope === 'GLOBAL' ? 'GLOBAL' : (detail.branch?.slug ?? '')) : defaultWhere,
    summary: detail?.summary ?? '',
    body: detail?.body ?? '',
    authorName: detail?.authorName ?? '',
    tags: detail?.tags.join(', ') ?? '',
    isPinned: detail?.isPinned ?? false,
    pinnedUntil: isoToZonedLocal(detail?.pinnedUntil, DEFAULT_TIME_ZONE),
    isFeatured: detail?.isFeatured ?? false,
    seoTitle: detail?.seoTitle ?? '',
    seoDescription: detail?.seoDescription ?? '',
    event: {
      starts: isoToZonedLocal(detail?.event?.startsAt, tz),
      ends: isoToZonedLocal(detail?.event?.endsAt, tz),
      allDay: detail?.event?.allDay ?? false,
      timezone: tz,
      category: detail?.event?.category ?? 'SERVICE',
      eventStatus: detail?.event?.eventStatus ?? 'SCHEDULED',
      statusNote: detail?.event?.statusNote ?? '',
      venueName: detail?.event?.venueName ?? '',
      venueAddress: detail?.event?.venueAddress ?? '',
      mapsUrl: detail?.event?.mapsUrl ?? '',
      onlineUrl: detail?.event?.onlineUrl ?? '',
      registrationUrl: detail?.event?.registrationUrl ?? '',
    },
    sermon: {
      preachedOn: detail?.sermon?.preachedOn ?? '',
      speaker: detail?.sermon?.speaker ?? '',
      speakerName: detail?.sermon?.speakerName ?? '',
      series: detail?.sermon?.series ?? '',
      scripture: detail?.sermon?.scripture ?? '',
      externalVideoUrl: detail?.sermon?.externalVideoUrl ?? '',
      durationMinutes:
        detail?.sermon?.durationSeconds != null ? String(Math.round(detail.sermon.durationSeconds / 60)) : '',
      language: detail?.sermon?.language ?? 'en',
      transcript: detail?.sermon?.transcript ?? '',
    },
    baptism: {
      baptismDate: detail?.baptism?.baptismDate ?? '',
      candidatesCount: detail?.baptism?.candidatesCount != null ? String(detail.baptism.candidatesCount) : '',
      officiantName: detail?.baptism?.officiantName ?? '',
      location: detail?.baptism?.location ?? '',
    },
  };
}

const orNull = (value: string) => (value.trim() === '' ? null : value.trim());
const numberOrNull = (value: string) => {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : Number.NaN;
};

/** Editor values → API payload (validated by the shared `ContentInput` schema afterwards). */
export function toInput(type: ContentType, values: ContentFormValues): ContentInput {
  const global = values.where === 'GLOBAL';
  const tz = values.event.timezone || DEFAULT_TIME_ZONE;
  const minutes = numberOrNull(values.sermon.durationMinutes);
  const candidates = numberOrNull(values.baptism.candidatesCount);
  return {
    type,
    scope: global ? 'GLOBAL' : 'BRANCH',
    branch: global ? null : orNull(values.where),
    title: values.title,
    slug: orNull(values.slug) ?? undefined,
    summary: values.summary,
    body: values.body,
    authorName: values.authorName,
    tags: values.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    isPinned: values.isPinned,
    pinnedUntil: values.isPinned ? zonedLocalToIso(values.pinnedUntil, DEFAULT_TIME_ZONE) : null,
    isFeatured: values.isFeatured,
    seoTitle: values.seoTitle,
    seoDescription: values.seoDescription,
    event:
      type === 'EVENT'
        ? {
            startsAt: zonedLocalToIso(values.event.starts, tz) ?? '',
            endsAt: zonedLocalToIso(values.event.ends, tz),
            allDay: values.event.allDay,
            timezone: tz,
            category: values.event.category as never,
            eventStatus: values.event.eventStatus as never,
            statusNote: values.event.statusNote,
            venueName: values.event.venueName,
            venueAddress: values.event.venueAddress,
            mapsUrl: orNull(values.event.mapsUrl),
            onlineUrl: orNull(values.event.onlineUrl),
            registrationUrl: orNull(values.event.registrationUrl),
          }
        : null,
    sermon:
      type === 'SERMON'
        ? {
            preachedOn: values.sermon.preachedOn,
            speaker: orNull(values.sermon.speaker),
            speakerName: values.sermon.speakerName,
            series: orNull(values.sermon.series),
            scripture: values.sermon.scripture,
            externalVideoUrl: orNull(values.sermon.externalVideoUrl),
            durationSeconds: minutes === null ? null : Math.round(minutes * 60),
            language: values.sermon.language || 'en',
            transcript: values.sermon.transcript,
          }
        : null,
    baptism:
      type === 'BAPTISM'
        ? {
            baptismDate: orNull(values.baptism.baptismDate),
            candidatesCount: candidates,
            officiantName: values.baptism.officiantName,
            location: values.baptism.location,
          }
        : null,
  };
}

const PATHS: Record<string, string> = {
  branch: 'where',
  scope: 'where',
  event: 'event.starts',
  'event.startsAt': 'event.starts',
  'event.endsAt': 'event.ends',
  sermon: 'sermon.preachedOn',
  'sermon.durationSeconds': 'sermon.durationMinutes',
  'baptism.candidatesCount': 'baptism.candidatesCount',
};

/** Map an API/schema error path ("event.startsAt") to the editor field that shows it. */
export function formPath(path: string): string {
  return PATHS[path] ?? path;
}
