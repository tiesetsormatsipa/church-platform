/**
 * Object storage held in a Map.
 *
 * For tests, and for working on a machine with no object store — which is the state of the
 * workstation this was built on. Selected with `STORAGE_DRIVER=memory`; refused outright in
 * production, because everything uploaded is lost when the process stops.
 *
 * The parts the rules depend on are modelled faithfully: `head` reports the size that
 * actually arrived and `getRange` returns real bytes, so type sniffing and the length check
 * are exercised for real rather than stubbed past.
 */
import type { Readable } from 'node:stream';
import { Readable as NodeReadable } from 'node:stream';
import type { ObjectHead, ObjectStorage, PresignedUpload } from './types.js';

interface StoredObject {
  body: Buffer;
  contentType: string;
}

export class MemoryObjectStorage implements ObjectStorage {
  readonly bucket = 'test-bucket';
  private readonly objects = new Map<string, StoredObject>();
  /** Upload URLs handed out but not yet used, so a test can "perform" the upload. */
  readonly tickets = new Map<string, { key: string; contentType: string }>();

  /** Stand in for the browser's PUT to the signed URL. */
  upload(key: string, body: Buffer, contentType = 'application/octet-stream'): void {
    this.objects.set(key, { body, contentType });
  }

  has(key: string): boolean {
    return this.objects.has(key);
  }

  createUploadUrl(
    key: string,
    options: { contentType: string; contentLength: number; expiresInSeconds: number },
  ): Promise<PresignedUpload> {
    const token = Buffer.from(key).toString('base64url');
    this.tickets.set(token, { key, contentType: options.contentType });
    return Promise.resolve({
      method: 'PUT',
      url: `https://storage.invalid/${token}`,
      headers: { 'content-type': options.contentType },
      expiresAt: new Date(Date.now() + options.expiresInSeconds * 1000),
    });
  }

  createDownloadUrl(key: string): Promise<string> {
    return Promise.resolve(`https://storage.invalid/download/${key}`);
  }

  publicUrl(key: string): string {
    return `https://storage.invalid/public/${key}`;
  }

  head(key: string): Promise<ObjectHead | null> {
    const object = this.objects.get(key);
    if (!object) return Promise.resolve(null);
    return Promise.resolve({
      size: object.body.length,
      contentType: object.contentType,
      etag: `"${object.body.length}"`,
    });
  }

  getRange(key: string, start: number, endInclusive: number): Promise<Buffer> {
    const object = this.objects.get(key);
    if (!object) throw new Error(`No such object: ${key}`);
    return Promise.resolve(object.body.subarray(start, endInclusive + 1));
  }

  getStream(key: string): Promise<Readable> {
    const object = this.objects.get(key);
    if (!object) throw new Error(`No such object: ${key}`);
    return Promise.resolve(NodeReadable.from(object.body));
  }

  async put(key: string, body: Buffer | Readable, options: { contentType: string }): Promise<void> {
    const buffer = Buffer.isBuffer(body) ? body : await toBuffer(body);
    this.objects.set(key, { body: buffer, contentType: options.contentType });
  }

  delete(key: string): Promise<void> {
    this.objects.delete(key);
    return Promise.resolve();
  }

  ping(): Promise<void> {
    return Promise.resolve();
  }
}

async function toBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Buffer));
  return Buffer.concat(chunks);
}

/** The first bytes of a real, tiny PNG, so the type sniffer sees what it expects. */
export const PNG_BYTES = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000100' +
    '05fe02fea7a6a10000000049454e44ae426082',
  'hex',
);

/** The first bytes of an MP3 frame, for the audio cases. */
export const MP3_BYTES = Buffer.concat([
  Buffer.from('494433', 'hex'), // "ID3"
  Buffer.alloc(128, 0),
]);
