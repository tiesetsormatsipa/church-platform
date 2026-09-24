import { Module } from '@nestjs/common';
import { FeaturesController } from './features.controller';
import { FeaturesService } from './features.service';
import { DatabaseModule } from '../../database/database.module';
import { AuditService } from '../admin/audit.service';

@Module({
  imports: [DatabaseModule],
  controllers: [FeaturesController],
  providers: [FeaturesService, AuditService],
  exports: [FeaturesService],
})
export class FeaturesModule {}
