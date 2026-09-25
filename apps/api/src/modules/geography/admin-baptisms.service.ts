import { Inject, Injectable } from '@nestjs/common';
import type { DatabaseClient, Prisma } from '@church/database';
import {
  branchTarget,
  type BaptismRecordDto,
  type CreateBaptismRecord,
  type UpdateBaptismRecord,
} from '@church/shared';
import type { z } from 'zod';
import { Errors } from '../../common/http/errors.js';
import type { Principal, RequestMeta } from '../../common/principal.js';
import { DATABASE } from '../../infrastructure/tokens.js';
import { AccessService } from '../access/access.service.js';
import { AuditService, diffFields } from '../core/audit.service.js';
import { OrganizationService } from '../core/organization.service.js';

const RECORD_SELECT = {
  id: true,
  occurredOn: true,
  count: true,
  note: true,
  createdAt: true,
  branch: { select: { id: true, slug: true, name: true } },
  recordedBy: {
    select: { profile: { select: { displayName: true, firstName: true, lastName: true } } },
  },
} as const satisfies Prisma.BranchBaptismRecordSelect;

type RecordRow = Prisma.BranchBaptismRecordGetPayload<{ select: typeof RECORD_SELECT }>;

function toDto(row: RecordRow): BaptismRecordDto {
  const profile = row.recordedBy?.profile;
  const name =
    profile?.displayName || [profile?.firstName, profile?.lastName].filter(Boolean).join(' ');
  return {
    id: row.id,
    branch: row.branch,
    occurredOn: row.occurredOn.toISOString().slice(0, 10),
    count: row.count,
    note: row.note,
    recordedBy: name || null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Recording baptisms. Whoever keeps a branch's records adds to its number after a service;
 * the permission is the same one that covers attendance and offering reports, checked against
 * the concrete branch so a branch administrator cannot post numbers for another branch.
 */
@Injectable()
export class AdminBaptismsService {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly organizations: OrganizationService,
  ) {}

  private async branchBySlug(slug: string) {
    const organization = await this.organizations.current();
    const branch = await this.db.branch.findFirst({
      where: { organizationId: organization.id, slug, deletedAt: null },
      select: { id: true, slug: true, name: true },
    });
    // Out of scope reads as "not there", the same as everywhere else in the admin API.
    if (!branch) throw Errors.notFound('That branch could not be found.');
    return { branch, organizationId: organization.id };
  }

  async list(principal: Principal, branchSlug: string): Promise<{ items: BaptismRecordDto[] }> {
    const { branch } = await this.branchBySlug(branchSlug);
    this.access.assert(principal, 'branch_record.read', branchTarget(branch.id));
    const rows = await this.db.branchBaptismRecord.findMany({
      where: { branchId: branch.id, deletedAt: null },
      select: RECORD_SELECT,
      orderBy: [{ occurredOn: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
    return { items: rows.map(toDto) };
  }

  async create(
    principal: Principal,
    input: z.output<typeof CreateBaptismRecord>,
    meta: RequestMeta,
  ): Promise<BaptismRecordDto> {
    const { branch, organizationId } = await this.branchBySlug(input.branch);
    this.access.assert(principal, 'branch_record.manage', branchTarget(branch.id));

    const row = await this.db.branchBaptismRecord.create({
      data: {
        branchId: branch.id,
        occurredOn: new Date(`${input.occurredOn}T00:00:00Z`),
        count: input.count,
        note: input.note ?? null,
        recordedById: principal.userId,
      },
      select: RECORD_SELECT,
    });

    await this.audit.record({
      organizationId,
      actorId: principal.userId,
      action: 'baptism_record.create',
      entityType: 'BranchBaptismRecord',
      entityId: row.id,
      branchId: branch.id,
      summary: `${input.count} baptised at ${branch.name} on ${input.occurredOn}`,
      meta,
    });
    return toDto(row);
  }

  async update(
    principal: Principal,
    id: string,
    input: z.output<typeof UpdateBaptismRecord>,
    meta: RequestMeta,
  ): Promise<BaptismRecordDto> {
    const organization = await this.organizations.current();
    const existing = await this.db.branchBaptismRecord.findFirst({
      where: { id, deletedAt: null, branch: { organizationId: organization.id, deletedAt: null } },
      select: { ...RECORD_SELECT, branchId: true },
    });
    if (!existing) throw Errors.notFound('That baptism entry could not be found.');
    this.access.assert(principal, 'branch_record.manage', branchTarget(existing.branchId));

    // Moving an entry to another branch needs the right over the destination too.
    let branchId = existing.branchId;
    if (input.branch && input.branch !== existing.branch.slug) {
      const destination = await this.branchBySlug(input.branch);
      this.access.assert(principal, 'branch_record.manage', branchTarget(destination.branch.id));
      branchId = destination.branch.id;
    }

    const row = await this.db.branchBaptismRecord.update({
      where: { id },
      data: {
        branchId,
        ...(input.occurredOn ? { occurredOn: new Date(`${input.occurredOn}T00:00:00Z`) } : {}),
        ...(input.count === undefined ? {} : { count: input.count }),
        ...(input.note === undefined ? {} : { note: input.note }),
      },
      select: RECORD_SELECT,
    });

    await this.audit.record({
      organizationId: organization.id,
      actorId: principal.userId,
      action: 'baptism_record.update',
      entityType: 'BranchBaptismRecord',
      entityId: id,
      branchId,
      changes: diffFields(
        { count: existing.count, occurredOn: existing.occurredOn, note: existing.note },
        { count: row.count, occurredOn: row.occurredOn, note: row.note },
      ),
      meta,
    });
    return toDto(row);
  }

  async remove(principal: Principal, id: string, meta: RequestMeta): Promise<{ id: string }> {
    const organization = await this.organizations.current();
    const existing = await this.db.branchBaptismRecord.findFirst({
      where: { id, deletedAt: null, branch: { organizationId: organization.id, deletedAt: null } },
      select: { id: true, branchId: true, count: true },
    });
    if (!existing) throw Errors.notFound('That baptism entry could not be found.');
    this.access.assert(principal, 'branch_record.manage', branchTarget(existing.branchId));

    // Soft delete: the number is a record of something that happened, so it stays readable.
    await this.db.branchBaptismRecord.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.record({
      organizationId: organization.id,
      actorId: principal.userId,
      action: 'baptism_record.delete',
      entityType: 'BranchBaptismRecord',
      entityId: id,
      branchId: existing.branchId,
      summary: `Removed an entry of ${existing.count}`,
      meta,
    });
    return { id };
  }
}
