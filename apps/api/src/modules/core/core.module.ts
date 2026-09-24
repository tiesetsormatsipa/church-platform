import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { MediaUrlService } from './media-urls.service.js';
import { OrganizationService } from './organization.service.js';
import { RateLimitService } from './rate-limit.service.js';

@Global()
@Module({
  providers: [AuditService, MediaUrlService, OrganizationService, RateLimitService],
  exports: [AuditService, MediaUrlService, OrganizationService, RateLimitService],
})
export class CoreModule {}
