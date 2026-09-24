import { Module } from '@nestjs/common';
import { BaptismController } from './baptism.controller.js';
import { BaptismService } from './baptism.service.js';

@Module({
  controllers: [BaptismController],
  providers: [BaptismService],
  exports: [BaptismService],
})
export class BaptismModule {}
