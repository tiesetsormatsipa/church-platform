import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuditService } from './audit.service';
import { DatabaseModule } from '../../database/database.module';
import { FeaturesModule } from '../features/features.module';

@Module({
  imports: [DatabaseModule, FeaturesModule],
  controllers: [AdminController],
  providers: [AdminService, AuditService],
  exports: [AdminService, AuditService],
})
export class AdminModule {}
