/**
 * Turn an uploaded file into something a page can use.
 *
 * For an image that means its real dimensions, a colour to show while it loads, and a few
 * smaller renditions so a phone on a slow connection does not download a 4000-pixel
 * photograph. Everything else is stored as it arrived; there is no transcoding here, because
 * a church VPS should not be re-encoding video, and the players handle what people upload.
 *
 * Idempotent: a retry re-reads the row, skips anything already READY, and writes variants by
 * a stable name so a second run overwrites rather than duplicates.
 */
import { mediaKey } from '@church/infrastructure/storage';
import type { JobPayload } from '@church/shared';
import sharp from 'sharp';
import type { JobContext } from '../runtime.js';

/** Widths worth keeping. Anything already smaller than a step is not upscaled. */
const WIDTHS = [320, 640, 1280] as const;

/** Re-encoded as WebP: every browser the church's members use reads it, and it is smaller. */
const VARIANT_TYPE = 'image/webp';

export async function processMedia(
  context: JobContext,
  payload: JobPayload<'processMedia'>,
): Promise<void> {
  const asset = await context.db.mediaAsset.findFirst({
    where: { id: payload.mediaId, deletedAt: null },
    select: {
      id: true,
      kind: true,
      status: true,
      visibility: true,
      storageKey: true,
      mimeType: true,
      createdAt: true,
    },
  });

  if (!asset) {
    context.logger.info({ mediaId: payload.mediaId }, 'Media is gone; nothing to process');
    return;
  }
  if (asset.status === 'READY') {
    context.logger.info({ mediaId: asset.id }, 'Media is already processed');
    return;
  }
  if (asset.status !== 'UPLOADED' && asset.status !== 'PROCESSING') {
    context.logger.info(
      { mediaId: asset.id, status: asset.status },
      'Media is not ready to process',
    );
    return;
  }

  await context.db.mediaAsset.update({
    where: { id: asset.id },
    data: { status: 'PROCESSING', processingError: null },
  });

  try {
    if (asset.kind === 'IMAGE') {
      await processImage(context, asset);
    } else {
      // Audio, video and documents are served exactly as uploaded.
      await context.db.mediaAsset.update({
        where: { id: asset.id },
        data: { status: 'READY', processedAt: new Date() },
      });
    }
    context.logger.info({ mediaId: asset.id, kind: asset.kind }, 'Media processed');
  } catch (error) {
    // The message goes to the person who uploaded it, so it must say something useful and
    // nothing internal.
    await context.db.mediaAsset.update({
      where: { id: asset.id },
      data: {
        status: 'FAILED',
        processingError: 'That file could not be read as an image. Try saving it again.',
      },
    });
    context.logger.error({ err: error, mediaId: asset.id }, 'Media processing failed');
    // Not rethrown: a corrupt file will still be corrupt on the fourth attempt, and the row
    // already records why. Storage failures are the retryable case and throw before here.
  }
}

interface ImageAsset {
  id: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  storageKey: string;
  createdAt: Date;
}

async function processImage(context: JobContext, asset: ImageAsset): Promise<void> {
  const original = await context.storage.getStream(asset.storageKey);
  const buffer = await toBuffer(original);

  const image = sharp(buffer, { failOn: 'error' });
  const meta = await image.metadata();
  const width = meta.width ?? null;
  const height = meta.height ?? null;

  // One pixel of the whole picture: its average colour, for the placeholder behind it.
  const { data } = await sharp(buffer).resize(1, 1, { fit: 'fill' }).raw().toBuffer({
    resolveWithObject: true,
  });
  const dominantColor = `#${[data[0] ?? 0, data[1] ?? 0, data[2] ?? 0]
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')}`;

  for (const target of WIDTHS) {
    // Never upscale: a 400-pixel photograph gains nothing from a 1280-pixel copy.
    if (width !== null && width <= target) continue;
    const rendition = await sharp(buffer)
      .rotate() // honour the EXIF orientation before resizing
      .resize({ width: target, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });

    const key = mediaKey({
      visibility: asset.visibility,
      mediaId: asset.id,
      name: `w${target}`,
      mimeType: VARIANT_TYPE,
      createdAt: asset.createdAt,
    });
    await context.storage.put(key, rendition.data, {
      contentType: VARIANT_TYPE,
      cacheControl: 'public, max-age=31536000, immutable',
    });

    // Stable name, so a retry replaces the row instead of adding a second one.
    await context.db.mediaVariant.upsert({
      where: { mediaId_name: { mediaId: asset.id, name: `w${target}` } },
      create: {
        mediaId: asset.id,
        name: `w${target}`,
        storageKey: key,
        mimeType: VARIANT_TYPE,
        width: rendition.info.width,
        height: rendition.info.height,
        sizeBytes: BigInt(rendition.info.size),
      },
      update: {
        storageKey: key,
        mimeType: VARIANT_TYPE,
        width: rendition.info.width,
        height: rendition.info.height,
        sizeBytes: BigInt(rendition.info.size),
      },
    });
  }

  await context.db.mediaAsset.update({
    where: { id: asset.id },
    data: { status: 'READY', width, height, dominantColor, processedAt: new Date() },
  });
}

async function toBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
