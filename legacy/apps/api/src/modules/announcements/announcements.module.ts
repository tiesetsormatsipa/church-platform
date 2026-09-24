import { Module } from '@nestjs/common';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';
import { DatabaseModule } from '../../database/database.module';
import { AuditService } from '../admin/audit.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService, AuditService],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
