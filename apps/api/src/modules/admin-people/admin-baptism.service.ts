import { Inject, Injectable } from '@nestjs/common';
import type { DatabaseClient, Prisma } from '@church/database';
import {
  type AdminBaptismList,
  type AdminBaptismQuery,
  type AdminBaptismRequest,
  branchTarget,
  can,
  type UpdateBaptismRequest,
} from '@church/shared';
import type { z } from 'zod';
import { Errors } from '../../common/http/errors.js';
import type { Principal, RequestMeta } from '../../common/principal.js';
import { DATABASE } from '../../infrastructure/tokens.js';
import { AccessService } from '../access/access.service.js';
import { AuditService } from '../core/audit.service.js';
import { OrganizationService } from '../core/organization.service.js';
import { isoDate } from '../content/content.mapper.js';
import { grantsFor, inScope, PERSON_SELECT, personRef } from './people.js';

const SELECT = {
  id: true,
  branchId: true,
  userId: true,
  fullName: true,
  email: true,
  phone: true,
  preferredDate: true,
  message: true,
  status: true,
  internalNotes: true,
  createdAt: true,
  handledAt: true,
  branch: { select: { id: true, slug: true, name: true } },
  assignedTo: { select: PERSON_SELECT },
} satisfies Prisma.BaptismRequestSelect;

type Row = Prisma.BaptismRequestGetPayload<{ select: typeof SELECT }>;

function toDto(row: Row): AdminBaptismRequest {
  return {
    id: row.id,
    branch: row.branch,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    preferredDate: isoDate(row.preferredDate),
    message: row.message,
    status: row.status,
    assignee: row.assignedTo ? personRef(row.assignedTo) : null,
    internalNotes: row.internalNotes,
    hasAccount: row.userId !== null,
    createdAt: row.createdAt.toISOString(),
    handledAt: row.handledAt?.toISOString() ?? null,
  };
}

/** The baptism enquiry inbox of each branch. */
@Injectable()
export class AdminBaptismService {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly organizations: OrganizationService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  async list(
    principal: Principal,
    query: z.output<typeof AdminBaptismQuery>,
  ): Promise<AdminBaptismList> {
    const organizationId = await this.organizations.currentId();
    const where: Prisma.BaptismRequestWhereInput = {
      organizationId,
      ...inScope(this.access.scopeOf(principal, 'baptism_request.manage')),
      ...(query.status ? { status: query.status } : {}),
      ...(query.branch ? { branch: { slug: query.branch } } : {}),
    };
    const [total, rows] = await Promise.all([
      this.db.baptismRequest.count({ where }),
      this.db.baptismRequest.findMany({
        where,
        select: SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items: rows.map(toDto), page: query.page, pageSize: query.pageSize, total };
  }

  async update(
    principal: Principal,
    id: string,
    input: z.output<typeof UpdateBaptismRequest>,
    meta: RequestMeta,
  ): Promise<AdminBaptismRequest> {
    const organizationId = await this.organizations.currentId();
    const current = await this.db.baptismRequest.findFirst({
      where: { id, organizationId },
      select: { id: true, branchId: true, status: true, assignedToId: true },
    });
    const target = current ? branchTarget(current.branchId) : null;
    if (!current || !target || !this.access.can(principal, 'baptism_request.manage', target)) {
      throw Errors.notFound('That enquiry');
    }
    if (input.assigneeId) {
      // Only people who can follow up enquiries for this branch can be assigned.
      const grants = await grantsFor(this.db, input.assigneeId, organizationId);
      if (!can(grants, 'baptism_request.manage', target)) {
        throw Errors.validation([
          { path: 'assigneeId', message: 'This person cannot follow up enquiries for the branch' },
        ]);
      }
    }
    const handled = input.status && input.status !== 'NEW' && current.status === 'NEW';
    const row = await this.db.baptismRequest.update({
      where: { id },
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.assigneeId !== undefined ? { assignedToId: input.assigneeId } : {}),
        ...(input.internalNotes !== undefined ? { internalNotes: input.internalNotes } : {}),
        ...(handled ? { handledAt: new Date() } : {}),
      },
      select: SELECT,
    });
    await this.audit.record({
      organizationId,
      actorId: principal.userId,
      action: 'baptism_request.update',
      entityType: 'BaptismRequest',
      entityId: id,
      branchId: current.branchId,
      changes: {
        ...(input.status && input.status !== current.status
          ? { status: { from: current.status, to: input.status } }
          : {}),
        ...(input.assigneeId !== undefined && input.assigneeId !== current.assignedToId
          ? { assignee: { from: current.assignedToId, to: input.assigneeId } }
          : {}),
        ...(input.internalNotes !== undefined
          ? { internalNotes: { from: '[changed]', to: '[changed]' } }
          : {}),
      },
      meta,
    });
    return toDto(row);
  }
}
