/**
 * Uploads.
 *
 * The API never carries the bytes. It issues a signed PUT, the browser uploads straight to
 * object storage, and the API is told afterwards — at which point it looks at what actually
 * arrived rather than what was promised: the real length from the object's head, and the
 * real type from its first bytes. A file that lies about either is deleted and the row is
 * marked FAILED, so a `.exe` renamed to `.jpg` never reaches the worker, let alone a page.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { DatabaseClient, Prisma } from '@church/database';
import { JobProducer } from '@church/infrastructure/queue';
import {
  isCompatibleMimeType,
  mediaKey,
  type ObjectStorage,
  sniffMimeType,
} from '@church/infrastructure/storage';
import {
  type CompleteUpload,
  kindForPurpose,
  type MediaDto,
  type MediaLibrary,
  type MediaLibraryQuery,
  type MediaPurpose,
  maxBytesFor,
  PURPOSE_RULES,
  type RequestUpload,
  type UpdateMedia,
  type UploadTicket,
} from '@church/shared';
import type { z } from 'zod';
import { Errors } from '../../common/http/errors.js';
import type { Principal, RequestMeta } from '../../common/principal.js';
import { DATABASE, STORAGE } from '../../infrastructure/tokens.js';
import { AccessService } from '../access/access.service.js';
import { AuditService } from '../core/audit.service.js';
import { MEDIA_URL_SELECT, MediaUrlService } from '../core/media-urls.service.js';
import { OrganizationService } from '../core/organization.service.js';

/** How long a signed upload URL is good for. Long enough for a slow phone on a long sermon. */
const UPLOAD_WINDOW_SECONDS = 15 * 60;

/** Enough bytes to recognise every format the sniffer knows. */
const SNIFF_BYTES = 64;

const MEDIA_SELECT = {
  ...MEDIA_URL_SELECT,
  purpose: true,
  kind: true,
  originalFilename: true,
  sizeBytes: true,
  durationSeconds: true,
  processingError: true,
  createdAt: true,
  uploadedById: true,
} satisfies Prisma.MediaAssetSelect;

type MediaRow = Prisma.MediaAssetGetPayload<{ select: typeof MEDIA_SELECT }>;

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    @Inject(STORAGE) private readonly storage: ObjectStorage,
    private readonly organizations: OrganizationService,
    private readonly access: AccessService,
    private readonly media: MediaUrlService,
    private readonly audit: AuditService,
    private readonly jobs: JobProducer,
  ) {}

  // -------------------------------------------------------------------------------------
  // Uploading
  // -------------------------------------------------------------------------------------

  async requestUpload(
    principal: Principal,
    input: z.output<typeof RequestUpload>,
    meta: RequestMeta,
  ): Promise<UploadTicket> {
    this.assertMayUpload(principal, input.purpose);
    const organizationId = await this.organizations.currentId();
    const kind = kindForPurpose(input.purpose);
    const { visibility } = PURPOSE_RULES[input.purpose];

    const asset = await this.db.mediaAsset.create({
      data: {
        organization: { connect: { id: organizationId } },
        uploadedBy: { connect: { id: principal.userId } },
        kind,
        purpose: input.purpose,
        status: 'PENDING_UPLOAD',
        visibility,
        // A placeholder: the real key needs the id, which only exists once the row does.
        storageKey: `pending/${crypto.randomUUID()}`,
        originalFilename: input.filename,
        mimeType: input.contentType,
        sizeBytes: BigInt(input.sizeBytes),
        altText: input.altText ?? null,
      },
      select: { id: true, createdAt: true },
    });

    const key = mediaKey({
      visibility,
      mediaId: asset.id,
      name: 'original',
      mimeType: input.contentType,
      createdAt: asset.createdAt,
    });
    await this.db.mediaAsset.update({ where: { id: asset.id }, data: { storageKey: key } });

    const upload = await this.storage.createUploadUrl(key, {
      contentType: input.contentType,
      contentLength: input.sizeBytes,
      expiresInSeconds: UPLOAD_WINDOW_SECONDS,
    });

    await this.audit.record({
      organizationId,
      actorId: principal.userId,
      action: 'media.request_upload',
      entityType: 'MediaAsset',
      entityId: asset.id,
      summary: `${input.purpose}: ${input.filename}`,
      meta,
    });

    return {
      mediaId: asset.id,
      method: 'PUT',
      url: upload.url,
      headers: upload.headers,
      expiresAt: upload.expiresAt.toISOString(),
    };
  }

  /**
   * The browser says the upload finished. Check what actually landed before believing it.
   */
  async complete(
    principal: Principal,
    id: string,
    input: z.output<typeof CompleteUpload>,
    meta: RequestMeta,
  ): Promise<MediaDto> {
    const asset = await this.loadOwn(principal, id);
    if (asset.status !== 'PENDING_UPLOAD') return this.toDto(asset);

    const head = await this.storage.head(asset.storageKey);
    if (!head) throw Errors.badRequest('upload_missing', 'That upload did not arrive.');

    const declared = asset.mimeType;
    const limit = maxBytesFor(asset.purpose);
    const problem = await this.inspect(asset.storageKey, head.size, declared, limit);
    if (problem) {
      await this.reject(asset.id, problem, meta, principal);
      throw Errors.badRequest('upload_rejected', problem);
    }

    await this.db.mediaAsset.update({
      where: { id: asset.id },
      data: {
        status: 'UPLOADED',
        // What arrived, not what was promised.
        sizeBytes: BigInt(head.size),
        ...(input.altText === undefined ? {} : { altText: input.altText }),
      },
    });

    await this.jobs
      .enqueue('processMedia', { mediaId: asset.id, requestId: meta.requestId })
      .catch((error: unknown) =>
        this.logger.error({ err: error, mediaId: asset.id }, 'Could not enqueue media processing'),
      );

    return this.get(principal, asset.id);
  }

  /** Size and first bytes must both agree with what the ticket was issued for. */
  private async inspect(
    key: string,
    size: number,
    declared: string,
    limit: number,
  ): Promise<string | null> {
    if (size === 0) return 'That file is empty.';
    if (size > limit) {
      return `That file is larger than the ${Math.round(limit / (1024 * 1024))} MB limit.`;
    }
    const head = await this.storage.getRange(key, 0, Math.min(SNIFF_BYTES, size) - 1);
    const sniffed = sniffMimeType(head);
    if (!isCompatibleMimeType(declared, sniffed)) {
      return 'That file is not the kind of file it claims to be.';
    }
    return null;
  }

  private async reject(id: string, reason: string, meta: RequestMeta, principal: Principal) {
    const asset = await this.db.mediaAsset.update({
      where: { id },
      data: { status: 'FAILED', processingError: reason },
      select: { storageKey: true },
    });
    // Nothing else will ever read it, so it should not sit in the bucket costing money.
    await this.storage
      .delete(asset.storageKey)
      .catch((error: unknown) => this.logger.warn({ err: error, id }, 'Could not delete upload'));
    await this.audit.record({
      organizationId: await this.organizations.currentId(),
      actorId: principal.userId,
      action: 'media.reject',
      entityType: 'MediaAsset',
      entityId: id,
      summary: reason,
      meta,
    });
  }

  // -------------------------------------------------------------------------------------
  // Reading and tidying
  // -------------------------------------------------------------------------------------

  async get(principal: Principal, id: string): Promise<MediaDto> {
    return this.toDto(await this.loadOwn(principal, id));
  }

  async library(
    principal: Principal,
    query: z.output<typeof MediaLibraryQuery>,
  ): Promise<MediaLibrary> {
    const organizationId = await this.organizations.currentId();
    const where: Prisma.MediaAssetWhereInput = {
      organizationId,
      deletedAt: null,
      status: 'READY',
      ...(query.purpose ? { purpose: query.purpose } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.q ? { originalFilename: { contains: query.q, mode: 'insensitive' } } : {}),
      // Someone who may only upload sees what they uploaded; media.manage sees everything.
      ...(this.access.canAnywhere(principal, 'media.manage')
        ? {}
        : { uploadedById: principal.userId }),
    };
    const [items, total] = await Promise.all([
      this.db.mediaAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: MEDIA_SELECT,
      }),
      this.db.mediaAsset.count({ where }),
    ]);
    return {
      items: items.map((row) => this.toDto(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async update(
    principal: Principal,
    id: string,
    input: z.output<typeof UpdateMedia>,
    meta: RequestMeta,
  ): Promise<MediaDto> {
    await this.loadOwn(principal, id);
    const updated = await this.db.mediaAsset.update({
      where: { id },
      data: { altText: input.altText ?? null },
      select: MEDIA_SELECT,
    });
    await this.audit.record({
      organizationId: await this.organizations.currentId(),
      actorId: principal.userId,
      action: 'media.update',
      entityType: 'MediaAsset',
      entityId: id,
      meta,
    });
    return this.toDto(updated);
  }

  /**
   * Soft delete. The object stays in the bucket: rows all over the schema point at it with
   * `onDelete: SetNull`, and a picture vanishing from a page the moment someone tidies the
   * library is worse than a little unused storage.
   */
  async remove(principal: Principal, id: string, meta: RequestMeta): Promise<void> {
    const asset = await this.loadOwn(principal, id);
    await this.db.mediaAsset.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'DELETED' },
    });
    await this.audit.record({
      organizationId: await this.organizations.currentId(),
      actorId: principal.userId,
      action: 'media.delete',
      entityType: 'MediaAsset',
      entityId: id,
      summary: asset.originalFilename,
      meta,
    });
  }

  // -------------------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------------------

  /** An avatar is your own business; everything else needs the upload permission. */
  private assertMayUpload(principal: Principal, purpose: MediaPurpose) {
    if (purpose === 'AVATAR') return;
    if (!this.access.canAnywhere(principal, 'media.upload')) {
      throw Errors.forbidden('You cannot upload files here.');
    }
  }

  /** Your own file, or anyone's if you may manage the library. Otherwise 404. */
  private async loadOwn(principal: Principal, id: string): Promise<MediaRow> {
    const organizationId = await this.organizations.currentId();
    const row = await this.db.mediaAsset.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
        ...(this.access.canAnywhere(principal, 'media.manage')
          ? {}
          : { uploadedById: principal.userId }),
      },
      select: MEDIA_SELECT,
    });
    if (!row) throw Errors.notFound('That file');
    return row;
  }

  private toDto(row: MediaRow): MediaDto {
    const image = row.kind === 'IMAGE' ? this.media.image(row) : null;
    return {
      id: row.id,
      kind: row.kind,
      purpose: row.purpose,
      status: row.status,
      filename: row.originalFilename,
      mimeType: row.mimeType,
      sizeBytes: Number(row.sizeBytes),
      url:
        image?.url ??
        (row.status === 'READY' && row.visibility === 'PUBLIC'
          ? this.storage.publicUrl(row.storageKey)
          : null),
      width: row.width,
      height: row.height,
      durationSeconds: row.durationSeconds,
      altText: row.altText,
      dominantColor: row.dominantColor,
      error: row.processingError,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
