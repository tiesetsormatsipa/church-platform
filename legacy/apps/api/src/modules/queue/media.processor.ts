import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Processor('media-processing')
export class MediaProcessor {
  private readonly logger = new Logger(MediaProcessor.name);
  constructor(private prisma: PrismaService) {}

  @Process('process-media')
  async handleProcessMedia(job: Job<{ assetId: string; jobId: string; context: string }>) {
    const { assetId, jobId } = job.data;
    this.logger.log(`Processing media asset ${assetId}`);
    await this.prisma.mediaProcessingJob.update({ where: { id: jobId }, data: { status: 'PROCESSING', startedAt: new Date(), attempts: { increment: 1 } } });
    try {
      // Processing stubs: sharp (images), fluent-ffmpeg (audio), pdf-parse (PDFs)
      this.logger.debug(`[STUB] Would process asset ${assetId}`);
      await this.prisma.mediaAsset.update({ where: { id: assetId }, data: { status: 'READY' } });
      await this.prisma.mediaProcessingJob.update({ where: { id: jobId }, data: { status: 'COMPLETED', completedAt: new Date() } });
    } catch (err) {
      await this.prisma.mediaProcessingJob.update({ where: { id: jobId }, data: { status: 'FAILED', error: String(err) } });
      await this.prisma.mediaAsset.update({ where: { id: assetId }, data: { status: 'FAILED' } });
      throw err;
    }
  }
}
