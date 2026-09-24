import { Controller, Get, Post, Patch, Param, Query, Body, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { FeaturesService } from '../features/features.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('admin')
@ApiBearerAuth()
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(private adminService: AdminService, private featuresService: FeaturesService) {}

  @Get('stats')
  @Roles('super-admin', 'platform-admin', 'branch-admin', 'country-admin', 'regional-admin')
  getStats(@Req() req: any) { return this.adminService.getPlatformStats(req.headers['x-tenant-id']); }

  @Public() @Get('brand-settings')
  getBrandSettings(@Req() req: any) {
    const tenantId = req?.headers?.['x-tenant-id'] || process.env.DEFAULT_TENANT_ID;
    return this.adminService.getBrandSettings(tenantId);
  }

  @Patch('brand-settings')
  @Roles('super-admin', 'platform-admin')
  updateBrandSettings(@Body() body: any, @Req() req: any) { return this.adminService.updateBrandSettings(req.headers['x-tenant-id'], body); }

  @Get('feature-flags')
  @Roles('super-admin', 'platform-admin')
  getFeatureFlags(@Req() req: any) { return this.featuresService.getAllFlags(req.headers['x-tenant-id']); }

  @Patch('feature-flags/:key')
  @Roles('global-super-admin', 'super-admin')
  toggleFeatureFlag(@Param('key') key: string, @Body() body: { enabled: boolean; reason?: string }, @Req() req: any) {
    return this.featuresService.toggle(key, body.enabled, req.user.id, body.reason, req.headers['x-tenant-id']);
  }

  @Post('feature-flags/:key/rollout-rules')
  @Roles('global-super-admin', 'super-admin')
  addRolloutRule(@Param('key') key: string, @Body() body: { ruleType: string; ruleValue: string; percentage?: number }, @Req() req: any) {
    return this.featuresService.addRolloutRule(key, body, req.headers['x-tenant-id']);
  }

  @Get('moderation/cases')
  @Roles('super-admin', 'platform-admin', 'branch-moderator')
  getModerationCases(@Query('status') status?: string) { return this.adminService.getModerationCases(status); }

  @Post('moderation/cases')
  @Roles('super-admin', 'platform-admin', 'branch-moderator')
  openCase(@Body() body: any, @Req() req: any) { return this.adminService.openModerationCase(body.subjectId, body.reason, req.user.id, body.description); }

  @Post('moderation/cases/:id/action')
  @Roles('super-admin', 'platform-admin', 'branch-moderator')
  takeModerationAction(@Param('id') id: string, @Body() body: { action: string; reason?: string; expiresAt?: string }, @Req() req: any) {
    return this.adminService.takeModerationAction(id, body.action, req.user.id, body.reason, body.expiresAt ? new Date(body.expiresAt) : undefined);
  }

  @Get('audit-logs')
  @Roles('super-admin', 'platform-admin')
  getAuditLogs(@Query('limit') limit = 50, @Query('offset') offset = 0, @Query('entityType') entityType?: string, @Query('userId') userId?: string, @Query('action') action?: string) {
    return this.adminService.getAuditLogs({ limit: +limit, offset: +offset, entityType, userId, action });
  }
}
