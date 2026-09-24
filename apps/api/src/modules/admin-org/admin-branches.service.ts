import { Inject, Injectable, Logger } from '@nestjs/common';
import type { DatabaseClient, Prisma } from '@church/database';
import { JobProducer } from '@church/infrastructure/queue';
import {
  type AdminBranchDetail,
  type AdminBranchRow,
  type AdminScheduleDto,
  type BranchInput,
  branchTarget,
  CacheTags,
  type LeaderInput,
  ORGANIZATION_TARGET,
  type ScheduleInput,
  uniqueSlug,
} from '@church/shared';
import type { z } from 'zod';
import { Errors } from '../../common/http/errors.js';
import type { Principal, RequestMeta } from '../../common/principal.js';
import { DATABASE } from '../../infrastructure/tokens.js';
import { AccessService } from '../access/access.service.js';
import { AuditService, diffFields } from '../core/audit.service.js';
import { OrganizationService } from '../core/organization.service.js';
import { isoDate } from '../content/content.mapper.js';

type BranchData = z.output<typeof BranchInput>;
type ScheduleData = z.output<typeof ScheduleInput>;
type LeaderData = z.output<typeof LeaderInput>;

const SCHEDULE_SELECT = {
  id: true,
  kind: true,
  title: true,
  dayOfWeek: true,
  startTime: true,
  endTime: true,
  recurrenceText: true,
  notes: true,
  effectiveFrom: true,
  effectiveUntil: true,
  replacesRegular: true,
  isActive: true,
  sortOrder: true,
} satisfies Prisma.BranchScheduleSelect;

const LEADER_SELECT = {
  id: true,
  name: true,
  title: true,
  bio: true,
  sortOrder: true,
  isActive: true,
} satisfies Prisma.BranchLeaderSelect;

function scheduleDto(
  row: Prisma.BranchScheduleGetPayload<{ select: typeof SCHEDULE_SELECT }>,
): AdminScheduleDto {
  return {
    ...row,
    effectiveFrom: isoDate(row.effectiveFrom),
    effectiveUntil: isoDate(row.effectiveUntil),
  };
}

function dateOrNull(value: string | null | undefined): Date | null {
  return value ? new Date(`${value}T00:00:00Z`) : null;
}

/** Branch details, service times and leaders. */
@Injectable()
export class AdminBranchesService {
  private readonly logger = new Logger(AdminBranchesService.name);

  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly organizations: OrganizationService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly jobs: JobProducer,
  ) {}

  async list(principal: Principal): Promise<{ items: AdminBranchRow[] }> {
    const organizationId = await this.organizations.currentId();
    const scope = this.access.scopeOf(principal, 'branch.update');
    const rows = await this.db.branch.findMany({
      where: { organizationId, deletedAt: null, ...(scope === 'ALL' ? {} : { id: { in: scope } }) },
      select: {
        id: true,
        slug: true,
        name: true,
        type: true,
        status: true,
        city: true,
        province: true,
        _count: { select: { memberships: { where: { status: 'ACTIVE' } } } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return {
      items: rows.map(({ _count, ...row }) => ({
        ...row,
        memberCount: _count.memberships,
        canEdit: this.access.can(principal, 'branch.update', branchTarget(row.id)),
      })),
    };
  }

  private async load(
    principal: Principal,
    slug: string,
    permission: 'branch.update' | 'branch.archive' = 'branch.update',
  ) {
    const organizationId = await this.organizations.currentId();
    const branch = await this.db.branch.findFirst({
      where: { organizationId, slug, deletedAt: null },
      select: { id: true, slug: true, name: true, status: true, parentBranchId: true },
    });
    if (!branch || !this.access.can(principal, permission, branchTarget(branch.id))) {
      throw Errors.notFound('That branch');
    }
    return { ...branch, organizationId };
  }

  async get(principal: Principal, slug: string): Promise<AdminBranchDetail> {
    const { id } = await this.load(principal, slug);
    const row = await this.db.branch.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        slug: true,
        name: true,
        type: true,
        status: true,
        legacyLabel: true,
        description: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        province: true,
        postalCode: true,
        countryCode: true,
        latitude: true,
        longitude: true,
        mapsUrl: true,
        phone: true,
        email: true,
        sortOrder: true,
        parentBranch: { select: { id: true, slug: true, name: true } },
        schedules: {
          select: SCHEDULE_SELECT,
          orderBy: [{ sortOrder: 'asc' }, { dayOfWeek: 'asc' }, { startTime: 'asc' }],
        },
        leaders: { select: LEADER_SELECT, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] },
      },
    });
    return {
      ...row,
      latitude: row.latitude === null ? null : Number(row.latitude),
      longitude: row.longitude === null ? null : Number(row.longitude),
      schedules: row.schedules.map(scheduleDto),
      canArchive: this.access.can(principal, 'branch.archive', ORGANIZATION_TARGET),
    };
  }

  private async parentId(
    organizationId: string,
    branchId: string | null,
    parentSlug: string | null | undefined,
  ) {
    if (!parentSlug) return null;
    const parent = await this.db.branch.findFirst({
      where: { organizationId, slug: parentSlug, deletedAt: null },
      select: { id: true },
    });
    if (!parent) throw Errors.validation([{ path: 'parentBranch', message: 'Unknown branch' }]);
    // Walk up from the new parent: reaching this branch would create a cycle.
    let cursor: string | null = parent.id;
    for (let depth = 0; cursor && depth < 20; depth += 1) {
      if (cursor === branchId) {
        throw Errors.validation([
          { path: 'parentBranch', message: 'A branch cannot sit under itself' },
        ]);
      }
      const next: { parentBranchId: string | null } | null = await this.db.branch.findUnique({
        where: { id: cursor },
        select: { parentBranchId: true },
      });
      cursor = next?.parentBranchId ?? null;
    }
    return parent.id;
  }

  private fields(input: BranchData) {
    return {
      name: input.name,
      type: input.type,
      description: input.description ?? null,
      addressLine1: input.addressLine1 ?? null,
      addressLine2: input.addressLine2 ?? null,
      city: input.city ?? null,
      province: input.province ?? null,
      postalCode: input.postalCode ?? null,
      countryCode: input.countryCode,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      mapsUrl: input.mapsUrl ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      sortOrder: input.sortOrder,
    };
  }

  async create(
    principal: Principal,
    input: BranchData,
    meta: RequestMeta,
  ): Promise<AdminBranchDetail> {
    this.access.assert(principal, 'branch.create', ORGANIZATION_TARGET);
    const organizationId = await this.organizations.currentId();
    const slug = await uniqueSlug(input.slug ?? input.name, async (candidate) =>
      Boolean(
        await this.db.branch.findFirst({
          where: { organizationId, slug: candidate },
          select: { id: true },
        }),
      ),
    );
    const branch = await this.db.branch.create({
      data: {
        organizationId,
        slug,
        ...this.fields(input),
        parentBranchId: await this.parentId(organizationId, null, input.parentBranch),
        createdById: principal.userId,
        updatedById: principal.userId,
      },
      select: { id: true },
    });
    await this.audit.record({
      organizationId,
      actorId: principal.userId,
      action: 'branch.create',
      entityType: 'Branch',
      entityId: branch.id,
      branchId: branch.id,
      summary: input.name,
      meta,
    });
    this.revalidate(slug, meta);
    return this.get(principal, slug);
  }

  async update(
    principal: Principal,
    slug: string,
    input: BranchData,
    meta: RequestMeta,
  ): Promise<AdminBranchDetail> {
    const branch = await this.load(principal, slug);
    if (input.slug && input.slug !== branch.slug) {
      throw Errors.conflict(
        'SLUG_LOCKED',
        'A branch’s address cannot change, so links keep working.',
      );
    }
    const before = await this.db.branch.findUniqueOrThrow({ where: { id: branch.id } });
    const data = {
      ...this.fields(input),
      parentBranchId: await this.parentId(branch.organizationId, branch.id, input.parentBranch),
    };
    await this.db.branch.update({
      where: { id: branch.id },
      data: { ...data, updatedById: principal.userId },
    });
    await this.audit.record({
      organizationId: branch.organizationId,
      actorId: principal.userId,
      action: 'branch.update',
      entityType: 'Branch',
      entityId: branch.id,
      branchId: branch.id,
      changes: diffFields(
        {
          ...before,
          latitude: before.latitude === null ? null : Number(before.latitude),
          longitude: before.longitude === null ? null : Number(before.longitude),
        } as Record<string, unknown>,
        data,
      ),
      meta,
    });
    this.revalidate(slug, meta);
    return this.get(principal, slug);
  }

  async setStatus(
    principal: Principal,
    slug: string,
    status: 'ACTIVE' | 'ARCHIVED',
    meta: RequestMeta,
  ): Promise<AdminBranchDetail> {
    const branch = await this.load(principal, slug, 'branch.archive');
    this.access.assert(principal, 'branch.archive', ORGANIZATION_TARGET);
    await this.db.branch.update({
      where: { id: branch.id },
      data: { status, updatedById: principal.userId },
    });
    await this.audit.record({
      organizationId: branch.organizationId,
      actorId: principal.userId,
      action: status === 'ARCHIVED' ? 'branch.archive' : 'branch.restore',
      entityType: 'Branch',
      entityId: branch.id,
      branchId: branch.id,
      summary: branch.name,
      meta,
    });
    this.revalidate(slug, meta);
    return this.get(principal, slug);
  }

  // ---------------------------------------------------------------------------------------
  // Service times
  // ---------------------------------------------------------------------------------------

  private scheduleData(input: ScheduleData) {
    return {
      kind: input.kind,
      title: input.title ?? null,
      dayOfWeek: input.dayOfWeek ?? null,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      recurrenceText: input.recurrenceText ?? null,
      notes: input.notes ?? null,
      effectiveFrom: dateOrNull(input.effectiveFrom),
      effectiveUntil: dateOrNull(input.effectiveUntil),
      replacesRegular: input.replacesRegular,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    };
  }

  async createSchedule(principal: Principal, slug: string, input: ScheduleData, meta: RequestMeta) {
    const branch = await this.load(principal, slug);
    const row = await this.db.branchSchedule.create({
      data: { branchId: branch.id, ...this.scheduleData(input) },
      select: { id: true },
    });
    await this.recordChild(
      principal,
      branch,
      'branch.schedule_create',
      'BranchSchedule',
      row.id,
      meta,
    );
    return this.get(principal, slug);
  }

  async updateSchedule(
    principal: Principal,
    slug: string,
    id: string,
    input: ScheduleData,
    meta: RequestMeta,
  ) {
    const branch = await this.load(principal, slug);
    const updated = await this.db.branchSchedule.updateMany({
      where: { id, branchId: branch.id },
      data: this.scheduleData(input),
    });
    if (updated.count === 0) throw Errors.notFound('That service time');
    await this.recordChild(principal, branch, 'branch.schedule_update', 'BranchSchedule', id, meta);
    return this.get(principal, slug);
  }

  async deleteSchedule(principal: Principal, slug: string, id: string, meta: RequestMeta) {
    const branch = await this.load(principal, slug);
    const deleted = await this.db.branchSchedule.deleteMany({ where: { id, branchId: branch.id } });
    if (deleted.count === 0) throw Errors.notFound('That service time');
    await this.recordChild(principal, branch, 'branch.schedule_delete', 'BranchSchedule', id, meta);
    return this.get(principal, slug);
  }

  // ---------------------------------------------------------------------------------------
  // Leaders
  // ---------------------------------------------------------------------------------------

  private leaderData(input: LeaderData) {
    return {
      name: input.name,
      title: input.title,
      bio: input.bio ?? null,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    };
  }

  async createLeader(principal: Principal, slug: string, input: LeaderData, meta: RequestMeta) {
    const branch = await this.load(principal, slug);
    const row = await this.db.branchLeader.create({
      data: { branchId: branch.id, ...this.leaderData(input) },
      select: { id: true },
    });
    await this.recordChild(principal, branch, 'branch.leader_create', 'BranchLeader', row.id, meta);
    return this.get(principal, slug);
  }

  async updateLeader(
    principal: Principal,
    slug: string,
    id: string,
    input: LeaderData,
    meta: RequestMeta,
  ) {
    const branch = await this.load(principal, slug);
    const updated = await this.db.branchLeader.updateMany({
      where: { id, branchId: branch.id },
      data: this.leaderData(input),
    });
    if (updated.count === 0) throw Errors.notFound('That leader');
    await this.recordChild(principal, branch, 'branch.leader_update', 'BranchLeader', id, meta);
    return this.get(principal, slug);
  }

  async deleteLeader(principal: Principal, slug: string, id: string, meta: RequestMeta) {
    const branch = await this.load(principal, slug);
    const deleted = await this.db.branchLeader.deleteMany({ where: { id, branchId: branch.id } });
    if (deleted.count === 0) throw Errors.notFound('That leader');
    await this.recordChild(principal, branch, 'branch.leader_delete', 'BranchLeader', id, meta);
    return this.get(principal, slug);
  }

  private async recordChild(
    principal: Principal,
    branch: { id: string; slug: string; organizationId: string; name: string },
    action: string,
    entityType: string,
    entityId: string,
    meta: RequestMeta,
  ) {
    await this.audit.record({
      organizationId: branch.organizationId,
      actorId: principal.userId,
      action,
      entityType,
      entityId,
      branchId: branch.id,
      summary: branch.name,
      meta,
    });
    this.revalidate(branch.slug, meta);
  }

  private revalidate(slug: string, meta: RequestMeta): void {
    void this.jobs
      .enqueue('revalidateWeb', {
        tags: [CacheTags.branches, CacheTags.branch(slug)],
        requestId: meta.requestId,
      })
      .catch((error: unknown) =>
        this.logger.warn({ err: error }, 'Could not enqueue cache revalidation'),
      );
  }
}
