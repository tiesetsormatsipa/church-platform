import { Module } from '@nestjs/common';
import { AdminBranchesService } from './admin-branches.service.js';
import { AdminBranchesController, AdminOrgController } from './admin-org.controller.js';
import { AdminOrgService } from './admin-org.service.js';

@Module({
  controllers: [AdminOrgController, AdminBranchesController],
  providers: [AdminOrgService, AdminBranchesService],
})
export class AdminOrgModule {}
