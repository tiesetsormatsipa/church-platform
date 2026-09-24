import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MulterModule } from '@nestjs/platform-express';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { StorageAdapter } from './storage.adapter';
import { DatabaseModule } from '../../database/database.module';
import { MediaProcessor } from '../queue/media.processor';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({ name: 'media-processing' }),
    MulterModule.register({ limits: { fileSize: 150 * 1024 * 1024 } }),
  ],
  controllers: [MediaController],
  providers: [MediaService, StorageAdapter, MediaProcessor],
  exports: [MediaService, StorageAdapter],
})
export class MediaModule {}
