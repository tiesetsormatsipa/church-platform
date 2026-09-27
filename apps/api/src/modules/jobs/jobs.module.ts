import { Module } from '@nestjs/common';
import { JobsController, MyJobsController } from './jobs.controller.js';
import { JobsService } from './jobs.service.js';

@Module({
  controllers: [JobsController, MyJobsController],
  providers: [JobsService],
})
export class JobsModule {}
