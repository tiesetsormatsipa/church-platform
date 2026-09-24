import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as path from 'path';
import { PrismaService } from '../../database/prisma.service';
import { StorageAdapter } from './storage.adapter';

const ALLOWED_RULES: Record<string, { mimes: string[]; maxBytes: number }> = {
  image:    { mimes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], maxBytes: 5 * 1024 * 1024 },
  audio:    { mimes: ['audio/mpeg', 'audio/mp3', 'audio/aac', 'audio/ogg', 'audio/wav'], maxBytes: 150 * 1024 * 1024 },
  document: { mimes: ['application/pdf'], maxBytes: 10 * 1024 * 1024 },
  chat_pdf: { mimes: ['application/pdf'], maxBytes: 500 * 1024 },
  profile:  { mimes: ['image/jpeg', 'image/png', 'image/webp'], maxBytes: 2 * 1024 * 1024 },
};

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageAdapter,
    private config: ConfigService,
    @InjectQueue('media-processing') private mediaQueue: Queue,
  ) {}

  async upload(file: Express.Multer.File, uploadedBy: string, context: string, isPublic = false, tenantId?: string) {
    const rule = ALLOWED_RULES[context];
    if (!rule) throw new BadRequestException(`Unknown upload context: ${context}`);
    if (!rule.mimes.includes(file.mimetype)) throw new BadRequestException(`File type ${file.mimetype} not allowed for ${context}.`);
    if (file.size > rule.maxBytes) throw new BadRequestException(`File too large for ${context}. Max: ${Math.round(rule.maxBytes / 1024)}KB`);

    const mediaType = this.detectMediaType(file.mimetype);
    const ext = path.extname(file.originalname) || `.${file.mimetype.split('/')[1]}`;
    const key = `${tenantId || 'global'}/${context}/${uploadedBy}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const url = await this.storage.upload(key, file.buffer, file.mimetype, isPublic);

    const asset = await this.prisma.mediaAsset.create({
      data: {
        uploaderId: uploadedBy, tenantId,
        type: mediaType as any, status: 'UPLOADING',
        originalName: file.originalname, storedKey: key,
        url: isPublic ? url : null, mimeType: file.mimetype,
        sizeBytes: file.size, isPublic,
      },
    });

    const processingJob = await this.prisma.mediaProcessingJob.create({
      data: { mediaAssetId: asset.id, status: 'QUEUED', jobType: this.getProcessingJobType(mediaType) },
    });

    await this.mediaQueue.add('process-media', { assetId: asset.id, jobId: processingJob.id, context }, { attempts: 3 });
    return asset;
  }

  async getSignedUrl(assetId: string, userId: string, expiresIn = 3600): Promise<string> {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: assetId } });
    if (!asset) throw new BadRequestException('Asset not found');
    if (asset.isPublic && asset.url) return asset.url;
    return this.storage.getSignedUrl(asset.storedKey, expiresIn);
  }

  async markReady(assetId: string, metadata?: Partial<{ durationSeconds: number; width: number; height: number; url: string }>) {
    return this.prisma.mediaAsset.update({ where: { id: assetId }, data: { status: 'READY', ...metadata } });
  }

  async delete(assetId: string, deletedBy: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: assetId } });
    if (!asset) return;
    await this.storage.delete(asset.storedKey);
    await this.prisma.mediaAsset.update({ where: { id: assetId }, data: { status: 'DELETED' } });
    this.logger.log(`Asset ${assetId} deleted by ${deletedBy}`);
  }

  private detectMediaType(mime: string): string {
    if (mime.startsWith('image/')) return 'IMAGE';
    if (mime.startsWith('audio/')) return 'AUDIO';
    if (mime.startsWith('video/')) return 'VIDEO';
    if (mime === 'application/pdf') return 'PDF';
    return 'DOCUMENT';
  }

  private getProcessingJobType(mediaType: string): string {
    const map: Record<string, string> = { IMAGE: 'IMAGE_RESIZE', AUDIO: 'AUDIO_TRANSCODE', PDF: 'PDF_VALIDATE' };
    return map[mediaType] || 'GENERIC_SCAN';
  }
}
