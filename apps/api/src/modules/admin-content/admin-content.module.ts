import { Module } from '@nestjs/common';
import { AdminContentController, AdminSpeakersController } from './admin-content.controller.js';
import { AdminContentService } from './admin-content.service.js';

@Module({
  controllers: [AdminContentController, AdminSpeakersController],
  providers: [AdminContentService],
})
export class AdminContentModule {}
