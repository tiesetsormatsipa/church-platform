import { Inject, Injectable } from '@nestjs/common';
import type { ObjectStorage } from '@church/infrastructure/storage';
import { STORAGE } from '../../infrastructure/tokens.js';

/** Minimal media shape needed to build public URLs. */
export interface MediaForUrls {
  id: string;
  storageKey: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  status: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  altText: string | null;
  dominantColor: string | null;
  variants?: {
    name: string;
    storageKey: string;
    width: number | null;
    height: number | null;
    mimeType: string;
  }[];
}

export interface ImageSource {
  url: string;
  width: number | null;
  height: number | null;
}

export interface PublicImage {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  alt: string | null;
  placeholderColor: string | null;
  /** Responsive renditions, smallest first. */
  sources: ImageSource[];
}

/** Prisma `select` for media used in public responses. */
export const MEDIA_URL_SELECT = {
  id: true,
  storageKey: true,
  visibility: true,
  status: true,
  mimeType: true,
  width: true,
  height: true,
  altText: true,
  dominantColor: true,
  variants: { select: { name: true, storageKey: true, width: true, height: true, mimeType: true } },
} as const;

@Injectable()
export class MediaUrlService {
  constructor(@Inject(STORAGE) private readonly storage: ObjectStorage) {}

  /** Public URL of an object key (only for keys under the public prefix). */
  publicUrl(storageKey: string): string {
    return this.storage.publicUrl(storageKey);
  }

  /** URLs for a public image; null for private, deleted or failed media. */
  image(media: MediaForUrls | null | undefined): PublicImage | null {
    if (
      !media ||
      media.visibility !== 'PUBLIC' ||
      media.status === 'DELETED' ||
      media.status === 'FAILED'
    ) {
      return null;
    }
    const sources = (media.variants ?? [])
      .filter((v) => v.name.startsWith('w') && v.width)
      .sort((a, b) => (a.width ?? 0) - (b.width ?? 0))
      .map((v) => ({
        url: this.storage.publicUrl(v.storageKey),
        width: v.width,
        height: v.height,
      }));
    return {
      id: media.id,
      url: this.storage.publicUrl(media.storageKey),
      width: media.width,
      height: media.height,
      alt: media.altText,
      placeholderColor: media.dominantColor,
      sources,
    };
  }

  /** Smallest rendition at least `minWidth` wide, falling back to the original. */
  imageUrl(media: MediaForUrls | null | undefined, minWidth = 320): string | null {
    const image = this.image(media);
    if (!image) return null;
    return image.sources.find((s) => (s.width ?? 0) >= minWidth)?.url ?? image.url;
  }
}
