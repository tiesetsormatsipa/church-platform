import { Module } from '@nestjs/common';
import { GeoController } from './geo.controller';
import { GeoService } from './geo.service';
import { DatabaseModule } from '../../database/database.module';
import { AuditService } from '../admin/audit.service';

@Module({
  imports: [DatabaseModule],
  controllers: [GeoController],
  providers: [GeoService, AuditService],
  exports: [GeoService],
})
export class GeoModule {}
