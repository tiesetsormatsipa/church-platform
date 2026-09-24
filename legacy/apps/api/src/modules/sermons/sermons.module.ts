import { Module } from '@nestjs/common';
import { SermonsController } from './sermons.controller';
import { SermonsService } from './sermons.service';
import { DatabaseModule } from '../../database/database.module';
import { AuditService } from '../admin/audit.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SermonsController],
  providers: [SermonsService, AuditService],
  exports: [SermonsService],
})
export class SermonsModule {}
