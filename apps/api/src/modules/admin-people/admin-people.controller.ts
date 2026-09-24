import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AdminBaptismList,
  AdminBaptismQuery,
  AdminBaptismRequest,
  AdminMembershipList,
  AdminMembershipQuery,
  AdminMembershipRow,
  AdminUserDetail,
  AdminUserList,
  AdminUserQuery,
  AssignRoleRequest,
  MembershipDecision,
  RoleList,
  UpdateBaptismRequest,
  UpdateUserStatusRequest,
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
import { Errors } from '../../common/http/errors.js';
import type { Principal, RequestMeta } from '../../common/principal.js';
import { AdminBaptismService } from './admin-baptism.service.js';
import { AdminMembershipsService } from './admin-memberships.service.js';
import { AdminUsersService } from './admin-users.service.js';

const WRITE_LIMIT = {
  name: 'admin.people.write',
  limit: 300,
  windowSeconds: 3600,
  by: 'user',
} as const;

@ApiTags('admin: memberships')
@RequireVerifiedEmail()
@RequirePermission('membership.review')
@Controller({ path: 'admin/memberships', version: '1' })
export class AdminMembershipsController {
  constructor(private readonly memberships: AdminMembershipsService) {}

  @Get()
  @ApiResult(AdminMembershipList)
  list(
    @CurrentUser() principal: Principal,
    @Query({ schema: AdminMembershipQuery }) query: z.output<typeof AdminMembershipQuery>,
  ) {
    return this.memberships.list(principal, query);
  }

  @Post(':id/decision')
  @HttpCode(200)
  @RateLimit(WRITE_LIMIT)
  @ApiOperation({ summary: 'Approve or decline a request, or remove a member.' })
  @ApiResult(AdminMembershipRow)
  decide(
    @CurrentUser() principal: Principal,
    @Param('id', { schema: Uuid }) id: string,
    @Body({ schema: MembershipDecision }) body: z.output<typeof MembershipDecision>,
    @Meta() meta: RequestMeta,
  ) {
    return this.memberships.decide(principal, id, body, meta);
  }
}

@ApiTags('admin: baptism')
@RequireVerifiedEmail()
@RequirePermission('baptism_request.manage')
@Controller({ path: 'admin/baptism-requests', version: '1' })
export class AdminBaptismController {
  constructor(private readonly baptism: AdminBaptismService) {}

  @Get()
  @ApiResult(AdminBaptismList)
  list(
    @CurrentUser() principal: Principal,
    @Query({ schema: AdminBaptismQuery }) query: z.output<typeof AdminBaptismQuery>,
  ) {
    return this.baptism.list(principal, query);
  }

  @Patch(':id')
  @RateLimit(WRITE_LIMIT)
  @ApiOperation({ summary: 'Update status, assignee or internal notes.' })
  @ApiResult(AdminBaptismRequest)
  update(
    @CurrentUser() principal: Principal,
    @Param('id', { schema: Uuid }) id: string,
    @Body({ schema: UpdateBaptismRequest }) body: z.output<typeof UpdateBaptismRequest>,
    @Meta() meta: RequestMeta,
  ) {
    return this.baptism.update(principal, id, body, meta);
  }
}

@ApiTags('admin: people')
@RequireVerifiedEmail()
@Controller({ path: 'admin', version: '1' })
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  /** `user.read` or `role.assign` anywhere; the service narrows what is visible. */
  private assertPeopleAccess(principal: Principal) {
    const ok = principal.grants.some(
      (g) => g.permissions.includes('user.read') || g.permissions.includes('role.assign'),
    );
    if (!ok) throw Errors.forbidden();
  }

  @Get('users')
  @ApiResult(AdminUserList)
  list(
    @CurrentUser() principal: Principal,
    @Query({ schema: AdminUserQuery }) query: z.output<typeof AdminUserQuery>,
  ) {
    this.assertPeopleAccess(principal);
    return this.users.list(principal, query);
  }

  @Get('users/:id')
  @ApiResult(AdminUserDetail)
  get(@CurrentUser() principal: Principal, @Param('id', { schema: Uuid }) id: string) {
    this.assertPeopleAccess(principal);
    return this.users.get(principal, id);
  }

  @Get('roles')
  @ApiOperation({ summary: 'Roles and their permissions.' })
  @ApiResult(RoleList)
  roles(@CurrentUser() principal: Principal) {
    this.assertPeopleAccess(principal);
    return this.users.roles();
  }

  @Post('users/:id/roles')
  @HttpCode(201)
  @RequirePermission('role.assign')
  @RateLimit(WRITE_LIMIT)
  @ApiOperation({ summary: 'Give a role church-wide or for one branch (no privilege escalation).' })
  @ApiResult(AdminUserDetail, { status: 201 })
  assign(
    @CurrentUser() principal: Principal,
    @Param('id', { schema: Uuid }) id: string,
    @Body({ schema: AssignRoleRequest }) body: z.output<typeof AssignRoleRequest>,
    @Meta() meta: RequestMeta,
  ) {
    return this.users.assignRole(principal, id, body, meta);
  }

  @Delete('users/:id/roles/:assignmentId')
  @RequirePermission('role.assign')
  @RateLimit(WRITE_LIMIT)
  @ApiResult(AdminUserDetail)
  revoke(
    @CurrentUser() principal: Principal,
    @Param('id', { schema: Uuid }) id: string,
    @Param('assignmentId', { schema: Uuid }) assignmentId: string,
    @Meta() meta: RequestMeta,
  ) {
    return this.users.revokeRole(principal, id, assignmentId, meta);
  }

  @Patch('users/:id/status')
  @RequirePermission('user.manage', 'ORGANIZATION')
  @RateLimit(WRITE_LIMIT)
  @ApiOperation({ summary: 'Suspend (signs the person out everywhere) or reactivate an account.' })
  @ApiResult(AdminUserDetail)
  setStatus(
    @CurrentUser() principal: Principal,
    @Param('id', { schema: Uuid }) id: string,
    @Body({ schema: UpdateUserStatusRequest }) body: z.output<typeof UpdateUserStatusRequest>,
    @Meta() meta: RequestMeta,
  ) {
    return this.users.setStatus(principal, id, body, meta);
  }
}
