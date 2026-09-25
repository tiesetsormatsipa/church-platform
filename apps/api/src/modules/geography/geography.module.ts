import { Global, Module } from '@nestjs/common';
import { AdminBaptismsController } from './admin-baptisms.controller.js';
import { AdminBaptismsService } from './admin-baptisms.service.js';
import { GeographyController } from './geography.controller.js';
import { GeographyService } from './geography.service.js';

@Global()
@Module({
  controllers: [GeographyController, AdminBaptismsController],
  providers: [GeographyService, AdminBaptismsService],
  exports: [GeographyService],
})
export class GeographyModule {}
