import type { Readable } from 'node:stream';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  NotFound,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { ObjectHead, ObjectStorage, PresignedUpload } from './types.js';

export interface S3StorageConfig {
  /** Custom endpoint for S3-compatible services (MinIO, RustFS, R2). Omit for AWS. */
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Required by most self-hosted S3 servers. */
  forcePathStyle: boolean;
  /**
   * Base URL at which objects under `public/` are served (CDN, Nginx proxy or bucket URL),
   * e.g. "https://church.example.org/media" or "http://localhost:9000/church-media".
   */
  publicBaseUrl: string;
  /**
   * Endpoint the *browser* uses for presigned URLs when it differs from the server's
   * (e.g. server talks to http://storage:9000 inside Docker, browser to https://s3.example.org).
   */
  presignEndpoint?: string;
}

function isNotFound(error: unknown): boolean {
  if (error instanceof NotFound) return true;
  if (error instanceof S3ServiceException) {
    return error.$metadata.httpStatusCode === 404 || error.name === 'NoSuchKey' || error.name === 'NotFound';
  }
  return false;
}

export class S3ObjectStorage implements ObjectStorage {
  readonly bucket: string;
  private readonly client: S3Client;
  private readonly presignClient: S3Client;
  private readonly publicBaseUrl: string;

  constructor(private readonly config: S3StorageConfig) {
    this.bucket = config.bucket;
    this.publicBaseUrl = config.publicBaseUrl.replace(/\/+$/, '');
    const common = {
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      // Newer SDKs add CRC32 checksums to requests by default; browsers cannot reproduce
      // them for presigned uploads and several S3-compatible services reject them.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    } as const;
    this.client = new S3Client({ ...common, ...(config.endpoint ? { endpoint: config.endpoint } : {}) });
    const presignEndpoint = config.presignEndpoint ?? config.endpoint;
    this.presignClient = new S3Client({ ...common, ...(presignEndpoint ? { endpoint: presignEndpoint } : {}) });
  }

  async createUploadUrl(
    key: string,
    options: { contentType: string; contentLength: number; expiresInSeconds: number },
  ): Promise<PresignedUpload> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: options.contentType,
      ContentLength: options.contentLength,
    });
    // Content-Type and Content-Length are signed, so the storage service rejects an upload
    // of a different size or type than the one the API approved.
    const url = await getSignedUrl(this.presignClient, command, {
      expiresIn: options.expiresInSeconds,
      signableHeaders: new Set(['content-type', 'content-length']),
    });
    return {
      method: 'PUT',
      url,
      headers: { 'Content-Type': options.contentType },
      expiresAt: new Date(Date.now() + options.expiresInSeconds * 1_000),
    };
  }

  async createDownloadUrl(
    key: string,
    options: { expiresInSeconds: number; filename?: string; inline?: boolean },
  ): Promise<string> {
    const disposition = options.filename
      ? `${options.inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(options.filename)}`
      : undefined;
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ...(disposition ? { ResponseContentDisposition: disposition } : {}),
    });
    return getSignedUrl(this.presignClient, command, { expiresIn: options.expiresInSeconds });
  }

  publicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }

  async head(key: string): Promise<ObjectHead | null> {
    try {
      const result = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return {
        size: result.ContentLength ?? 0,
        contentType: result.ContentType ?? null,
        etag: result.ETag ?? null,
      };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async getRange(key: string, start: number, endInclusive: number): Promise<Buffer> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: `bytes=${start}-${endInclusive}` }),
    );
    if (!result.Body) return Buffer.alloc(0);
    return Buffer.from(await result.Body.transformToByteArray());
  }

  async getStream(key: string): Promise<Readable> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!result.Body) throw new Error(`Empty body for ${key}`);
    return result.Body as Readable;
  }

  async put(
    key: string,
    body: Buffer | Readable,
    options: { contentType: string; cacheControl?: string; contentLength?: number },
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: options.contentType,
        ...(options.cacheControl ? { CacheControl: options.cacheControl } : {}),
        ...(options.contentLength !== undefined ? { ContentLength: options.contentLength } : {}),
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async ping(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }

  /**
   * Create the bucket if needed and (optionally) allow anonymous reads under `public/`.
   * Intended for development and self-hosted storage; managed providers (R2, S3 + CDN)
   * are usually configured out of band.
   */
  async ensureBucket(options: { publicPrefix?: string } = {}): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error) {
      if (!isNotFound(error) && !(error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404)) {
        throw error;
      }
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
    if (options.publicPrefix) {
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'PublicReadForPublicPrefix',
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${this.bucket}/${options.publicPrefix}*`],
          },
        ],
      };
      await this.client.send(
        new PutBucketPolicyCommand({ Bucket: this.bucket, Policy: JSON.stringify(policy) }),
      );
    }
  }

  destroy(): void {
    this.client.destroy();
    this.presignClient.destroy();
  }
}
