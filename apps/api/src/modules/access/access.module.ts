import { Global, Module } from '@nestjs/common';
import { AccessService } from './access.service.js';
import { PermissionGuard } from './permission.guard.js';

@Global()
@Module({
  providers: [AccessService, PermissionGuard],
  exports: [AccessService, PermissionGuard],
})
export class AccessModule {}
