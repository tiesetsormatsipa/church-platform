import { Inject, Injectable } from '@nestjs/common';
import type { DatabaseClient, Prisma } from '@church/database';
import {
  type AccessTarget,
  type AdminUserDetail,
  type AdminUserList,
  type AdminUserQuery,
  type AdminUserRow,
  type AssignRoleRequest,
  branchTarget,
  can,
  canAssignRole,
  type Grant,
  isPermission,
  ORGANIZATION_TARGET,
  type RoleDto,
  scopeOf,
  type UpdateUserStatusRequest,
} from '@church/shared';
import type { z } from 'zod';
import { Errors } from '../../common/http/errors.js';
import type { Principal, RequestMeta } from '../../common/principal.js';
import { DATABASE } from '../../infrastructure/tokens.js';
import { SessionService } from '../auth/session.service.js';
import { BranchQueryService } from '../branches/branch-query.service.js';
import { AuditService } from '../core/audit.service.js';
import { OrganizationService } from '../core/organization.service.js';
import { grantsFor, PERSON_SELECT, personName } from './people.js';

const USER_ROW_SELECT = {
  ...PERSON_SELECT,
  emailVerifiedAt: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  profile: {
    select: {
      firstName: true,
      lastName: true,
      displayName: true,
      phone: true,
      homeBranch: { select: { id: true, slug: true, name: true } },
    },
  },
} satisfies Prisma.UserSelect;

type UserRowData = Prisma.UserGetPayload<{ select: typeof USER_ROW_SELECT }>;

function targetOf(branchId: string | null): AccessTarget {
  return branchId ? branchTarget(branchId) : ORGANIZATION_TARGET;
}

/** People and their roles. Branch administrators see the members of their own branches. */
@Injectable()
export class AdminUsersService {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly organizations: OrganizationService,
    private readonly branches: BranchQueryService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
  ) {}

  /** Everyone for church-wide `user.read`, else members of the principal's branches. */
  private visibility(principal: Principal, organizationId: string): Prisma.UserWhereInput {
    const read = scopeOf(principal.grants, 'user.read');
    if (read === 'ALL') return { deletedAt: null };
    const assign = scopeOf(principal.grants, 'role.assign');
    const branchIds = assign === 'ALL' ? null : [...new Set([...read, ...assign])];
    if (branchIds === null) return { deletedAt: null };
    return {
      deletedAt: null,
      memberships: {
        some: {
          branchId: { in: branchIds },
          status: { in: ['PENDING', 'ACTIVE'] },
          branch: { organizationId },
        },
      },
    };
  }

  private async assignmentsOf(userId: string, organizationId: string) {
    return this.db.roleAssignment.findMany({
      where: { userId, organizationId },
      select: {
        id: true,
        branchId: true,
        grantedAt: true,
        role: {
          select: {
            key: true,
            name: true,
            scope: true,
            permissions: { select: { permission: true } },
          },
        },
        branch: { select: { id: true, slug: true, name: true } },
        grantedBy: { select: PERSON_SELECT },
      },
      orderBy: { grantedAt: 'asc' },
    });
  }

  private row(user: UserRowData, roles: string[]): AdminUserRow {
    return {
      id: user.id,
      name: personName(user),
      email: user.email,
      emailVerified: user.emailVerifiedAt !== null,
      status: user.status,
      homeBranch: user.profile?.homeBranch ?? null,
      roles,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async list(principal: Principal, query: z.output<typeof AdminUserQuery>): Promise<AdminUserList> {
    const organizationId = await this.organizations.currentId();
    const filters: Prisma.UserWhereInput[] = [this.visibility(principal, organizationId)];
    if (query.status) filters.push({ status: query.status });
    if (query.branch) {
      filters.push({
        memberships: {
          some: {
            branch: { slug: query.branch, organizationId },
            status: { in: ['PENDING', 'ACTIVE'] },
          },
        },
      });
    }
    if (query.q) {
      const q = query.q;
      filters.push({
        OR: [
          { email: { contains: q.toLowerCase() } },
          { profile: { firstName: { contains: q, mode: 'insensitive' } } },
          { profile: { lastName: { contains: q, mode: 'insensitive' } } },
          { profile: { displayName: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }
    const where: Prisma.UserWhereInput = { AND: filters };
    const [total, users] = await Promise.all([
      this.db.user.count({ where }),
      this.db.user.findMany({
        where,
        select: {
          ...USER_ROW_SELECT,
          roleAssignments: {
            where: { organizationId },
            select: { role: { select: { name: true } }, branch: { select: { name: true } } },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      items: users.map((u) =>
        this.row(
          u,
          u.roleAssignments.map((a) =>
            a.branch ? `${a.role.name} (${a.branch.name})` : a.role.name,
          ),
        ),
      ),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  private async loadVisible(principal: Principal, id: string, organizationId: string) {
    const user = await this.db.user.findFirst({
      where: { AND: [{ id }, this.visibility(principal, organizationId)] },
      select: { ...USER_ROW_SELECT, statusReason: true },
    });
    if (!user) throw Errors.notFound('That person');
    return user;
  }

  /** Whether the principal holds every permission `target` holds, wherever they hold it. */
  private outranks(principal: Principal, target: Grant[]): boolean {
    return target.every((g) =>
      g.permissions.every((p) => can(principal.grants, p, targetOf(g.branchId))),
    );
  }

  async get(principal: Principal, id: string): Promise<AdminUserDetail> {
    const organizationId = await this.organizations.currentId();
    const user = await this.loadVisible(principal, id, organizationId);
    const [assignments, memberships, targetGrants] = await Promise.all([
      this.assignmentsOf(id, organizationId),
      this.db.branchMembership.findMany({
        where: { userId: id, branch: { organizationId, deletedAt: null } },
        select: {
          id: true,
          status: true,
          requestedAt: true,
          branch: { select: { id: true, slug: true, name: true } },
        },
        orderBy: { requestedAt: 'desc' },
      }),
      grantsFor(this.db, id, organizationId),
    ]);
    return {
      ...this.row(
        user,
        assignments.map((a) => (a.branch ? `${a.role.name} (${a.branch.name})` : a.role.name)),
      ),
      phone: user.profile?.phone ?? null,
      statusReason: user.statusReason,
      memberships: memberships.map((m) => ({ ...m, requestedAt: m.requestedAt.toISOString() })),
      assignments: assignments.map((a) => ({
        id: a.id,
        role: { key: a.role.key, name: a.role.name, scope: a.role.scope },
        branch: a.branch,
        grantedBy: a.grantedBy ? personName(a.grantedBy) : null,
        grantedAt: a.grantedAt.toISOString(),
        revocable:
          id !== principal.userId &&
          canAssignRole(
            principal.grants,
            {
              scope: a.role.scope,
              permissions: a.role.permissions.map((p) => p.permission).filter(isPermission),
            },
            targetOf(a.branchId),
          ),
      })),
      canManageStatus:
        id !== principal.userId &&
        can(principal.grants, 'user.manage', ORGANIZATION_TARGET) &&
        this.outranks(principal, targetGrants),
    };
  }

  async roles(): Promise<{ items: RoleDto[] }> {
    const organizationId = await this.organizations.currentId();
    const roles = await this.db.role.findMany({
      where: { organizationId },
      select: {
        key: true,
        name: true,
        description: true,
        scope: true,
        permissions: { select: { permission: true } },
      },
      orderBy: [{ scope: 'desc' }, { name: 'asc' }],
    });
    return {
      items: roles.map((r) => ({
        ...r,
        permissions: r.permissions.map((p) => p.permission).sort(),
      })),
    };
  }

  async assignRole(
    principal: Principal,
    userId: string,
    input: z.output<typeof AssignRoleRequest>,
    meta: RequestMeta,
  ): Promise<AdminUserDetail> {
    const organizationId = await this.organizations.currentId();
    const user = await this.loadVisible(principal, userId, organizationId);
    if (user.status !== 'ACTIVE')
      throw Errors.conflict('USER_INACTIVE', 'Reactivate this account before giving it a role.');
    const role = await this.db.role.findFirst({
      where: { organizationId, key: input.role },
      select: {
        id: true,
        key: true,
        name: true,
        scope: true,
        permissions: { select: { permission: true } },
      },
    });
    if (!role) throw Errors.validation([{ path: 'role', message: 'Unknown role' }]);
    if ((role.scope === 'BRANCH') !== Boolean(input.branch)) {
      throw Errors.validation([
        {
          path: 'branch',
          message:
            role.scope === 'BRANCH' ? 'Choose the branch' : 'This role applies to the whole church',
        },
      ]);
    }
    const branch = input.branch
      ? await this.branches.resolveRef(organizationId, input.branch)
      : null;
    const target = targetOf(branch?.id ?? null);
    const permissions = role.permissions.map((p) => p.permission).filter(isPermission);
    if (!canAssignRole(principal.grants, { scope: role.scope, permissions }, target)) {
      throw Errors.forbidden(
        'You can only give roles whose permissions you hold yourself, where you hold them.',
      );
    }
    const existing = await this.db.roleAssignment.findFirst({
      where: { userId, roleId: role.id, branchId: branch?.id ?? null },
      select: { id: true },
    });
    if (existing)
      throw Errors.conflict('ROLE_ALREADY_ASSIGNED', 'This person already has that role.');
    const assignment = await this.db.roleAssignment.create({
      data: {
        userId,
        roleId: role.id,
        organizationId,
        branchId: branch?.id ?? null,
        grantedById: principal.userId,
      },
      select: { id: true },
    });
    await this.audit.record({
      organizationId,
      actorId: principal.userId,
      action: 'role.assign',
      entityType: 'RoleAssignment',
      entityId: assignment.id,
      branchId: branch?.id ?? null,
      summary: `${role.name}${branch ? ` (${branch.name})` : ''} → ${personName(user)}`,
      meta,
    });
    return this.get(principal, userId);
  }

  async revokeRole(
    principal: Principal,
    userId: string,
    assignmentId: string,
    meta: RequestMeta,
  ): Promise<AdminUserDetail> {
    const organizationId = await this.organizations.currentId();
    const user = await this.loadVisible(principal, userId, organizationId);
    const assignment = (await this.assignmentsOf(userId, organizationId)).find(
      (a) => a.id === assignmentId,
    );
    if (!assignment) throw Errors.notFound('That role');
    if (userId === principal.userId) {
      throw Errors.forbidden('You cannot remove your own roles. Ask another administrator.');
    }
    const permissions = assignment.role.permissions.map((p) => p.permission).filter(isPermission);
    if (
      !canAssignRole(
        principal.grants,
        { scope: assignment.role.scope, permissions },
        targetOf(assignment.branchId),
      )
    ) {
      throw Errors.forbidden('You cannot remove this role.');
    }
    await this.db.roleAssignment.delete({ where: { id: assignmentId } });
    await this.audit.record({
      organizationId,
      actorId: principal.userId,
      action: 'role.revoke',
      entityType: 'RoleAssignment',
      entityId: assignmentId,
      branchId: assignment.branchId,
      summary: `${assignment.role.name}${assignment.branch ? ` (${assignment.branch.name})` : ''} ✕ ${personName(user)}`,
      meta,
    });
    return this.get(principal, userId);
  }

  async setStatus(
    principal: Principal,
    userId: string,
    input: z.output<typeof UpdateUserStatusRequest>,
    meta: RequestMeta,
  ): Promise<AdminUserDetail> {
    const organizationId = await this.organizations.currentId();
    const detail = await this.get(principal, userId);
    if (!detail.canManageStatus)
      throw Errors.forbidden('You cannot change the status of this account.');
    await this.db.user.update({
      where: { id: userId },
      data: {
        status: input.status,
        statusReason: input.status === 'SUSPENDED' ? (input.reason ?? null) : null,
      },
    });
    if (input.status === 'SUSPENDED') await this.sessions.revokeAll(userId, 'suspended');
    await this.audit.record({
      organizationId,
      actorId: principal.userId,
      action: input.status === 'SUSPENDED' ? 'user.suspend' : 'user.reactivate',
      entityType: 'User',
      entityId: userId,
      summary: input.reason ?? null,
      meta,
    });
    return this.get(principal, userId);
  }
}
