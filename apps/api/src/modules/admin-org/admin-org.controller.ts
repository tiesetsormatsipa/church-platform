import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AdminBranchDetail,
  AdminBranchList,
  AdminOrganization,
  AdminSummary,
  AuditList,
  AuditQuery,
  BranchInput,
  LeaderInput,
  OrganizationSettingsInput,
  ScheduleInput,
  Slug,
  Uuid,
} from '@church/shared';
import type { z } from 'zod';
import {
  ApiResult,
  CurrentUser,
  Meta,
  RateLimit,
  RequirePermission,
  RequireVerifiedEmail,
} from '../../common/decorators/index.js';
import type { Principal, RequestMeta } from '../../common/principal.js';
import { AdminBranchesService } from './admin-branches.service.js';
import { AdminOrgService } from './admin-org.service.js';

const WRITE_LIMIT = {
  name: 'admin.org.write',
  limit: 300,
  windowSeconds: 3600,
  by: 'user',
} as const;

@ApiTags('admin')
@RequireVerifiedEmail()
@Controller({ path: 'admin', version: '1' })
export class AdminOrgController {
  constructor(private readonly org: AdminOrgService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Which admin areas you can use, and what needs attention.' })
  @ApiResult(AdminSummary)
  summary(@CurrentUser() principal: Principal) {
    return this.org.summary(principal);
  }

  @Get('audit')
  @RequirePermission('audit.read', 'ORGANIZATION')
  @ApiResult(AuditList)
  audit(@Query({ schema: AuditQuery }) query: z.output<typeof AuditQuery>) {
    return this.org.auditLog(query);
  }

  @Get('settings')
  @RequirePermission('settings.manage', 'ORGANIZATION')
  @ApiResult(AdminOrganization)
  settings() {
    return this.org.settings();
  }

  @Put('settings')
  @RequirePermission('settings.manage', 'ORGANIZATION')
  @RateLimit(WRITE_LIMIT)
  @ApiResult(AdminOrganization)
  updateSettings(
    @CurrentUser() principal: Principal,
    @Body({ schema: OrganizationSettingsInput }) body: z.output<typeof OrganizationSettingsInput>,
    @Meta() meta: RequestMeta,
  ) {
    return this.org.updateSettings(principal, body, meta);
  }
}

@ApiTags('admin: branches')
@RequireVerifiedEmail()
@RequirePermission('branch.update')
@Controller({ path: 'admin/branches', version: '1' })
export class AdminBranchesController {
  constructor(private readonly branches: AdminBranchesService) {}

  @Get()
  @ApiResult(AdminBranchList)
  list(@CurrentUser() principal: Principal) {
    return this.branches.list(principal);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission('branch.create', 'ORGANIZATION')
  @RateLimit(WRITE_LIMIT)
  @ApiResult(AdminBranchDetail, { status: 201 })
  create(
    @CurrentUser() principal: Principal,
    @Body({ schema: BranchInput }) body: z.output<typeof BranchInput>,
    @Meta() meta: RequestMeta,
  ) {
    return this.branches.create(principal, body, meta);
  }

  @Get(':slug')
  @ApiResult(AdminBranchDetail)
  get(@CurrentUser() principal: Principal, @Param('slug', { schema: Slug }) slug: string) {
    return this.branches.get(principal, slug);
  }

  @Put(':slug')
  @RateLimit(WRITE_LIMIT)
  @ApiResult(AdminBranchDetail)
  update(
    @CurrentUser() principal: Principal,
    @Param('slug', { schema: Slug }) slug: string,
    @Body({ schema: BranchInput }) body: z.output<typeof BranchInput>,
    @Meta() meta: RequestMeta,
  ) {
    return this.branches.update(principal, slug, body, meta);
  }

  @Post(':slug/archive')
  @HttpCode(200)
  @RequirePermission('branch.archive', 'ORGANIZATION')
  @ApiOperation({ summary: 'Hide a branch from the site (its content stays in the database).' })
  @ApiResult(AdminBranchDetail)
  archive(
    @CurrentUser() principal: Principal,
    @Param('slug', { schema: Slug }) slug: string,
    @Meta() meta: RequestMeta,
  ) {
    return this.branches.setStatus(principal, slug, 'ARCHIVED', meta);
  }

  @Post(':slug/restore')
  @HttpCode(200)
  @RequirePermission('branch.archive', 'ORGANIZATION')
  @ApiResult(AdminBranchDetail)
  restore(
    @CurrentUser() principal: Principal,
    @Param('slug', { schema: Slug }) slug: string,
    @Meta() meta: RequestMeta,
  ) {
    return this.branches.setStatus(principal, slug, 'ACTIVE', meta);
  }

  @Post(':slug/schedules')
  @HttpCode(201)
  @RateLimit(WRITE_LIMIT)
  @ApiResult(AdminBranchDetail, { status: 201 })
  createSchedule(
    @CurrentUser() principal: Principal,
    @Param('slug', { schema: Slug }) slug: string,
    @Body({ schema: ScheduleInput }) body: z.output<typeof ScheduleInput>,
    @Meta() meta: RequestMeta,
  ) {
    return this.branches.createSchedule(principal, slug, body, meta);
  }

  @Put(':slug/schedules/:id')
  @RateLimit(WRITE_LIMIT)
  @ApiResult(AdminBranchDetail)
  updateSchedule(
    @CurrentUser() principal: Principal,
    @Param('slug', { schema: Slug }) slug: string,
    @Param('id', { schema: Uuid }) id: string,
    @Body({ schema: ScheduleInput }) body: z.output<typeof ScheduleInput>,
    @Meta() meta: RequestMeta,
  ) {
    return this.branches.updateSchedule(principal, slug, id, body, meta);
  }

  @Delete(':slug/schedules/:id')
  @RateLimit(WRITE_LIMIT)
  @ApiResult(AdminBranchDetail)
  deleteSchedule(
    @CurrentUser() principal: Principal,
    @Param('slug', { schema: Slug }) slug: string,
    @Param('id', { schema: Uuid }) id: string,
    @Meta() meta: RequestMeta,
  ) {
    return this.branches.deleteSchedule(principal, slug, id, meta);
  }

  @Post(':slug/leaders')
  @HttpCode(201)
  @RateLimit(WRITE_LIMIT)
  @ApiResult(AdminBranchDetail, { status: 201 })
  createLeader(
    @CurrentUser() principal: Principal,
    @Param('slug', { schema: Slug }) slug: string,
    @Body({ schema: LeaderInput }) body: z.output<typeof LeaderInput>,
    @Meta() meta: RequestMeta,
  ) {
    return this.branches.createLeader(principal, slug, body, meta);
  }

  @Put(':slug/leaders/:id')
  @RateLimit(WRITE_LIMIT)
  @ApiResult(AdminBranchDetail)
  updateLeader(
    @CurrentUser() principal: Principal,
    @Param('slug', { schema: Slug }) slug: string,
    @Param('id', { schema: Uuid }) id: string,
    @Body({ schema: LeaderInput }) body: z.output<typeof LeaderInput>,
    @Meta() meta: RequestMeta,
  ) {
    return this.branches.updateLeader(principal, slug, id, body, meta);
  }

  @Delete(':slug/leaders/:id')
  @RateLimit(WRITE_LIMIT)
  @ApiResult(AdminBranchDetail)
  deleteLeader(
    @CurrentUser() principal: Principal,
    @Param('slug', { schema: Slug }) slug: string,
    @Param('id', { schema: Uuid }) id: string,
    @Meta() meta: RequestMeta,
  ) {
    return this.branches.deleteLeader(principal, slug, id, meta);
  }
}
