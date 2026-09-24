import { Injectable } from '@nestjs/common';
import {
  type ContentDetail,
  contentPath,
  type ContentSummary,
  excerpt,
  type MediaSourceDto,
} from '@church/shared';
import { MediaUrlService } from '../core/media-urls.service.js';
import type { ContentDetailRow, ContentSummaryRow } from './content.select.js';

export function isoDate(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

interface MediaSourceRow {
  storageKey: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  status: string;
  mimeType: string;
  durationSeconds: number | null;
  variants: { name: string; storageKey: string; mimeType: string }[];
}

/** Maps database rows to public DTOs. The only place content responses are shaped. */
@Injectable()
export class ContentMapper {
  constructor(private readonly media: MediaUrlService) {}

  summary(row: ContentSummaryRow): ContentSummary {
    const profile = row.author?.profile;
    const authorName =
      row.authorName ??
      (profile
        ? profile.displayName || `${profile.firstName} ${profile.lastName}`.trim() || null
        : null);
    const cover = this.media.image(row.coverMedia);
    const pinnedActive = row.isPinned && (!row.pinnedUntil || row.pinnedUntil > new Date());
    return {
      id: row.id,
      type: row.type,
      slug: row.slug,
      path: contentPath(row.type, row.slug),
      title: row.title,
      summary: row.summary ?? excerpt(row.body, 220),
      scope: row.scope,
      branch: row.branch
        ? { id: row.branch.id, slug: row.branch.slug, name: row.branch.name }
        : null,
      // Visible content always has a publication time.
      publishedAt: (row.publishedAt ?? new Date(0)).toISOString(),
      isPinned: pinnedActive,
      isFeatured: row.isFeatured,
      cover: cover ? { ...cover, alt: row.coverAlt ?? cover.alt } : null,
      authorName,
      tags: row.tags.map((t) => ({ slug: t.tag.slug, name: t.tag.name })),
      event: row.event
        ? {
            startsAt: row.event.startsAt.toISOString(),
            endsAt: row.event.endsAt?.toISOString() ?? null,
            allDay: row.event.allDay,
            timezone: row.event.timezone,
            category: row.event.category,
            eventStatus: row.event.eventStatus,
            venueName: row.event.venueName,
          }
        : null,
      sermon: row.sermon
        ? {
            preachedOn: isoDate(row.sermon.preachedOn)!,
            speakerName: row.sermon.speaker?.name ?? row.sermon.speakerName,
            speakerSlug: row.sermon.speaker?.slug ?? null,
            seriesTitle: row.sermon.series?.title ?? null,
            seriesSlug: row.sermon.series?.slug ?? null,
            scripture: row.sermon.scripture,
            durationSeconds: row.sermon.durationSeconds,
            hasAudio: row.sermon.audioMediaId !== null,
            hasVideo: row.sermon.videoMediaId !== null || row.sermon.externalVideoUrl !== null,
          }
        : null,
      baptism: row.baptism
        ? {
            baptismDate: isoDate(row.baptism.baptismDate),
            candidatesCount: row.baptism.candidatesCount,
          }
        : null,
    };
  }

  detail(row: ContentDetailRow, related: ContentSummary[]): ContentDetail {
    const summary = this.summary(row);
    return {
      ...summary,
      body: row.body,
      bodyFormat: row.bodyFormat,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      updatedAt: row.updatedAt.toISOString(),
      gallery: row.media
        .map((item) => {
          const image = this.media.image(item.media);
          return image ? { ...image, caption: item.caption } : null;
        })
        .filter((image): image is NonNullable<typeof image> => image !== null),
      eventDetail: row.event
        ? {
            ...summary.event!,
            statusNote: row.event.statusNote,
            venueAddress: row.event.venueAddress,
            mapsUrl: row.event.mapsUrl,
            onlineUrl: row.event.onlineUrl,
            registrationUrl: row.event.registrationUrl,
          }
        : null,
      sermonDetail: row.sermon
        ? {
            ...summary.sermon!,
            speaker: row.sermon.speaker
              ? {
                  slug: row.sermon.speaker.slug,
                  name: row.sermon.speaker.name,
                  title: row.sermon.speaker.title,
                }
              : null,
            series: row.sermon.series
              ? { slug: row.sermon.series.slug, title: row.sermon.series.title }
              : null,
            audio: this.source(row.sermon.audioMedia),
            video: this.source(row.sermon.videoMedia),
            externalVideoUrl: row.sermon.externalVideoUrl,
            language: row.sermon.language,
            transcript: row.sermon.transcript,
          }
        : null,
      baptismDetail: row.baptism
        ? {
            ...summary.baptism!,
            officiantName: row.baptism.officiantName,
            location: row.baptism.location,
          }
        : null,
      related,
    };
  }

  /** Playable source for public audio/video; only once processing has finished. */
  private source(media: MediaSourceRow | null): MediaSourceDto | null {
    if (!media || media.visibility !== 'PUBLIC' || media.status !== 'READY') return null;
    const poster = media.variants.find((v) => v.name === 'poster');
    return {
      url: this.media.publicUrl(media.storageKey),
      mimeType: media.mimeType,
      durationSeconds: media.durationSeconds,
      posterUrl: poster ? this.media.publicUrl(poster.storageKey) : null,
    };
  }
}
