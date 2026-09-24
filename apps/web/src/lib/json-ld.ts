import type { ContentDetail } from '@church/shared';

/** Serialise structured data for a <script type="application/ld+json"> without allowing `</script>` breakouts. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

interface Site {
  origin: string;
  organizationName: string;
}

const EVENT_STATUS = {
  SCHEDULED: 'https://schema.org/EventScheduled',
  POSTPONED: 'https://schema.org/EventPostponed',
  CANCELLED: 'https://schema.org/EventCancelled',
} as const;

/** ISO 8601 duration ("PT48M") for schema.org. */
export function isoDuration(seconds: number | null | undefined): string | undefined {
  if (!seconds || seconds <= 0) return undefined;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `PT${h ? `${h}H` : ''}${m ? `${m}M` : ''}${s ? `${s}S` : ''}`;
}

function images(item: ContentDetail, site: Site): string[] | undefined {
  if (!item.cover) return undefined;
  return [new URL(item.cover.url, site.origin).toString()];
}

/** schema.org description of a content item (Event, NewsArticle, sermon media or Article). */
export function contentJsonLd(item: ContentDetail, site: Site): Record<string, unknown> {
  const url = new URL(item.path, site.origin).toString();
  const publisher = { '@type': 'Organization', name: site.organizationName, url: site.origin };
  const common = { '@context': 'https://schema.org', url, description: item.summary || undefined, image: images(item, site) };

  if (item.eventDetail) {
    const e = item.eventDetail;
    const place = e.venueName || e.venueAddress ? { '@type': 'Place', name: e.venueName ?? e.venueAddress, address: e.venueAddress ?? undefined } : null;
    const online = e.onlineUrl ? { '@type': 'VirtualLocation', url: e.onlineUrl } : null;
    const location = [place, online].filter(Boolean);
    return {
      ...common,
      '@type': 'Event',
      name: item.title,
      startDate: e.startsAt,
      endDate: e.endsAt ?? undefined,
      eventStatus: EVENT_STATUS[e.eventStatus],
      eventAttendanceMode: place && online
        ? 'https://schema.org/MixedEventAttendanceMode'
        : online
          ? 'https://schema.org/OnlineEventAttendanceMode'
          : 'https://schema.org/OfflineEventAttendanceMode',
      location: location.length === 1 ? location[0] : location.length ? location : undefined,
      organizer: publisher,
    };
  }

  if (item.sermonDetail) {
    const s = item.sermonDetail;
    const media = s.video ?? s.audio;
    return {
      ...common,
      '@type': s.video ? 'VideoObject' : s.audio ? 'AudioObject' : 'CreativeWork',
      name: item.title,
      uploadDate: item.publishedAt,
      datePublished: s.preachedOn,
      duration: isoDuration(s.durationSeconds),
      contentUrl: media ? new URL(media.url, site.origin).toString() : undefined,
      thumbnailUrl: s.video?.posterUrl ? new URL(s.video.posterUrl, site.origin).toString() : images(item, site)?.[0],
      author: s.speaker ? { '@type': 'Person', name: s.speaker.name } : undefined,
      inLanguage: s.language,
      publisher,
    };
  }

  return {
    ...common,
    '@type': item.type === 'NEWS' ? 'NewsArticle' : 'Article',
    headline: item.title.slice(0, 110),
    datePublished: item.publishedAt,
    dateModified: item.updatedAt,
    author: item.authorName ? { '@type': 'Person', name: item.authorName } : publisher,
    publisher,
    mainEntityOfPage: url,
  };
}
