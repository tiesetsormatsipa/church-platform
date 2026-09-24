import { Global, Module } from '@nestjs/common';
import { BranchQueryService } from './branch-query.service.js';
import { PublicBranchesController } from './public-branches.controller.js';

@Global()
@Module({
  controllers: [PublicBranchesController],
  providers: [BranchQueryService],
  exports: [BranchQueryService],
})
export class BranchesModule {}
