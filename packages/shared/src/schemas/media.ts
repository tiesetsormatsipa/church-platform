/**
 * Uploads.
 *
 * A file arrives in three steps, because the API never handles the bytes: the caller asks
 * for a ticket, PUTs the file straight to object storage with the signed URL, then tells the
 * API it is done. Only then does the server look at what actually landed — its real size and
 * its real first bytes — and hand it to the worker. Nothing a browser claims about a file is
 * believed; the claim only decides whether a ticket is issued at all.
 */
import { z } from 'zod';
import { IsoDateTime, optionalText, text, Uuid } from '../common.js';
import { MediaKind, MediaPurpose, MediaStatus } from '../enums.js';

/** What each kind of file may be, and how large. Enforced again after the upload. */
export const MEDIA_RULES = {
  IMAGE: {
    maxBytes: 12 * 1024 * 1024,
    types: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
  },
  AUDIO: {
    maxBytes: 200 * 1024 * 1024,
    types: ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/wav'],
  },
  VIDEO: { maxBytes: 500 * 1024 * 1024, types: ['video/mp4', 'video/webm'] },
  DOCUMENT: { maxBytes: 20 * 1024 * 1024, types: ['application/pdf'] },
} as const satisfies Record<MediaKind, { maxBytes: number; types: readonly string[] }>;

/** The kind of file each purpose expects, and where it is stored. */
export const PURPOSE_RULES = {
  COVER: { kind: 'IMAGE', visibility: 'PUBLIC' },
  AVATAR: { kind: 'IMAGE', visibility: 'PUBLIC' },
  GALLERY: { kind: 'IMAGE', visibility: 'PUBLIC' },
  LEADER_PHOTO: { kind: 'IMAGE', visibility: 'PUBLIC' },
  SERMON_AUDIO: { kind: 'AUDIO', visibility: 'PUBLIC' },
  SERMON_VIDEO: { kind: 'VIDEO', visibility: 'PUBLIC' },
  SONG_AUDIO: { kind: 'AUDIO', visibility: 'PUBLIC' },
  DOCUMENT: { kind: 'DOCUMENT', visibility: 'PRIVATE' },
} as const satisfies Record<MediaPurpose, { kind: MediaKind; visibility: 'PUBLIC' | 'PRIVATE' }>;

export function kindForPurpose(purpose: MediaPurpose): MediaKind {
  return PURPOSE_RULES[purpose].kind;
}

/** Is this content type allowed for this purpose? */
export function isAllowedType(purpose: MediaPurpose, contentType: string): boolean {
  const { types } = MEDIA_RULES[kindForPurpose(purpose)];
  return (types as readonly string[]).includes(contentType);
}

export function maxBytesFor(purpose: MediaPurpose): number {
  return MEDIA_RULES[kindForPurpose(purpose)].maxBytes;
}

export const RequestUpload = z
  .object({
    purpose: MediaPurpose.schema,
    /** Shown in the media library; never used to build the storage key. */
    filename: text(255),
    contentType: text(127),
    sizeBytes: z.number().int().positive(),
    altText: optionalText(300),
  })
  .superRefine((value, ctx) => {
    if (!isAllowedType(value.purpose, value.contentType)) {
      ctx.addIssue({
        code: 'custom',
        path: ['contentType'],
        message: 'That kind of file cannot be used here.',
      });
    }
    if (value.sizeBytes > maxBytesFor(value.purpose)) {
      const mb = Math.round(maxBytesFor(value.purpose) / (1024 * 1024));
      ctx.addIssue({ code: 'custom', path: ['sizeBytes'], message: `Keep it under ${mb} MB.` });
    }
  })
  .meta({ id: 'RequestUpload' });
export type RequestUpload = z.input<typeof RequestUpload>;

/** Everything the browser needs to PUT the file itself. */
export const UploadTicket = z
  .object({
    mediaId: Uuid,
    method: z.literal('PUT'),
    url: z.string(),
    /** Must be sent exactly as given: they are part of the signature. */
    headers: z.record(z.string(), z.string()),
    expiresAt: IsoDateTime,
  })
  .meta({ id: 'UploadTicket' });
export type UploadTicket = z.infer<typeof UploadTicket>;

export const MediaDto = z.object({
  id: Uuid,
  kind: MediaKind.schema,
  purpose: MediaPurpose.schema,
  status: MediaStatus.schema,
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  /** Null until the upload is finished; for private files, a link that expires. */
  url: z.string().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  durationSeconds: z.number().int().nullable(),
  altText: z.string().nullable(),
  dominantColor: z.string().nullable(),
  /** Why processing failed, when it did. Safe to show. */
  error: z.string().nullable(),
  createdAt: IsoDateTime,
});
export type MediaDto = z.infer<typeof MediaDto>;

export const MediaItem = MediaDto.meta({ id: 'MediaItem' });

export const CompleteUpload = z
  .object({ altText: optionalText(300) })
  .meta({ id: 'CompleteUpload' });
export type CompleteUpload = z.input<typeof CompleteUpload>;

export const MediaLibraryQuery = z.object({
  purpose: MediaPurpose.schema.optional(),
  kind: MediaKind.schema.optional(),
  q: text(100).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
});
export type MediaLibraryQuery = z.input<typeof MediaLibraryQuery>;

export const MediaLibrary = z
  .object({
    items: z.array(MediaDto),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  })
  .meta({ id: 'MediaLibrary' });
export type MediaLibrary = z.infer<typeof MediaLibrary>;

export const UpdateMedia = z.object({ altText: optionalText(300) }).meta({ id: 'UpdateMedia' });
export type UpdateMedia = z.input<typeof UpdateMedia>;
