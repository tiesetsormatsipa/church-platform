import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { MemoryObjectStorage } from '@church/infrastructure/storage';
import sharp from 'sharp';
import { createWorkerTestContext, type WorkerTestContext } from '../test/harness.js';
import { processMedia } from './process-media.js';

let ctx: WorkerTestContext;
let organizationId: string;
let storage: MemoryObjectStorage;

beforeAll(async () => {
  ctx = await createWorkerTestContext();
  organizationId = (await ctx.context.organization()).id;
  storage = ctx.context.storage as MemoryObjectStorage;
});

afterAll(async () => {
  await ctx?.close();
});

let counter = 0;
const unique = () => `${Date.now().toString(36)}-${(counter += 1)}`;

/** A real photograph, so sharp has something genuine to measure and resize. */
async function photograph(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 40, b: 60 } },
  })
    .png()
    .toBuffer();
}

async function uploaded(options: { kind?: 'IMAGE' | 'AUDIO'; body: Buffer; mimeType: string }) {
  const key = `public/2026/09/${unique()}/original.bin`;
  storage.upload(key, options.body, options.mimeType);
  const asset = await ctx.db.mediaAsset.create({
    data: {
      organizationId,
      kind: options.kind ?? 'IMAGE',
      purpose: options.kind === 'AUDIO' ? 'SONG_AUDIO' : 'COVER',
      status: 'UPLOADED',
      visibility: 'PUBLIC',
      storageKey: key,
      originalFilename: 'test.bin',
      mimeType: options.mimeType,
      sizeBytes: BigInt(options.body.length),
    },
    select: { id: true },
  });
  return asset.id;
}

describe('processMedia', () => {
  it('measures a photograph, finds its colour and makes the smaller copies', async () => {
    const id = await uploaded({ body: await photograph(1600, 900), mimeType: 'image/png' });

    await processMedia(ctx.job(), { mediaId: id });

    const row = await ctx.db.mediaAsset.findUniqueOrThrow({
      where: { id },
      select: { status: true, width: true, height: true, dominantColor: true, processedAt: true },
    });
    expect(row.status).toBe('READY');
    expect(row.width).toBe(1600);
    expect(row.height).toBe(900);
    // The colour behind the picture while it loads, taken from the picture itself.
    expect(row.dominantColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(row.processedAt).not.toBeNull();

    const variants = await ctx.db.mediaVariant.findMany({
      where: { mediaId: id },
      orderBy: { width: 'asc' },
    });
    expect(variants.map((v) => v.name)).toEqual(['w320', 'w640', 'w1280']);
    for (const variant of variants) {
      expect(variant.mimeType).toBe('image/webp');
      // Every rendition is smaller than the original, which is the whole point of making it.
      expect(Number(variant.sizeBytes)).toBeLessThan(1600 * 900 * 3);
      expect(storage.has(variant.storageKey)).toBe(true);
    }
  });

  it('does not blow a small picture up to sizes it never had', async () => {
    const id = await uploaded({ body: await photograph(400, 400), mimeType: 'image/png' });

    await processMedia(ctx.job(), { mediaId: id });

    const variants = await ctx.db.mediaVariant.findMany({ where: { mediaId: id } });
    // 320 is worth making; 640 and 1280 would be the same picture, only heavier.
    expect(variants.map((v) => v.name)).toEqual(['w320']);
  });

  it('leaves audio exactly as it arrived', async () => {
    const body = Buffer.from('ID3 and then some bytes that are not a picture');
    const id = await uploaded({ kind: 'AUDIO', body, mimeType: 'audio/mpeg' });

    await processMedia(ctx.job(), { mediaId: id });

    const row = await ctx.db.mediaAsset.findUniqueOrThrow({
      where: { id },
      select: { status: true, width: true },
    });
    // Nothing is transcoded: a church server should not be re-encoding a two-hour sermon,
    // and every player reads what people upload.
    expect(row.status).toBe('READY');
    expect(row.width).toBeNull();
    expect(await ctx.db.mediaVariant.count({ where: { mediaId: id } })).toBe(0);
  });

  it('records why a file it cannot read failed, in words the uploader can act on', async () => {
    const id = await uploaded({
      body: Buffer.from('this is not a picture'),
      mimeType: 'image/png',
    });

    await processMedia(ctx.job(), { mediaId: id });

    const row = await ctx.db.mediaAsset.findUniqueOrThrow({
      where: { id },
      select: { status: true, processingError: true },
    });
    expect(row.status).toBe('FAILED');
    expect(row.processingError).toContain('could not be read');
    // Nothing internal leaks into a message somebody will read.
    expect(row.processingError).not.toMatch(/Error:|stack|sharp/i);
  });

  it('writes the same renditions, not a second set, when the job runs again', async () => {
    const id = await uploaded({ body: await photograph(1600, 900), mimeType: 'image/png' });

    await processMedia(ctx.job(), { mediaId: id });
    // A retry after a crash re-reads the row; already READY, so there is nothing to redo.
    await processMedia(ctx.job(), { mediaId: id });

    expect(await ctx.db.mediaVariant.count({ where: { mediaId: id } })).toBe(3);
  });

  it('does nothing at all for media that is gone', async () => {
    await expect(
      processMedia(ctx.job(), { mediaId: '00000000-0000-7000-8000-000000000000' }),
    ).resolves.toBeUndefined();
  });
});
