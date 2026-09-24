import type { Readable } from 'node:stream';

export interface PresignedUpload {
  method: 'PUT';
  url: string;
  /** Headers the client must send with the upload (they are part of the signature). */
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface ObjectHead {
  size: number;
  contentType: string | null;
  etag: string | null;
}

/** Object storage used by the API (presigning, verification) and the worker (processing). */
export interface ObjectStorage {
  readonly bucket: string;
  createUploadUrl(
    key: string,
    options: { contentType: string; contentLength: number; expiresInSeconds: number },
  ): Promise<PresignedUpload>;
  createDownloadUrl(
    key: string,
    options: { expiresInSeconds: number; filename?: string; inline?: boolean },
  ): Promise<string>;
  /** Stable URL for objects under the public prefix. */
  publicUrl(key: string): string;
  head(key: string): Promise<ObjectHead | null>;
  getRange(key: string, start: number, endInclusive: number): Promise<Buffer>;
  getStream(key: string): Promise<Readable>;
  put(
    key: string,
    body: Buffer | Readable,
    options: { contentType: string; cacheControl?: string; contentLength?: number },
  ): Promise<void>;
  delete(key: string): Promise<void>;
  ping(): Promise<void>;
}
