import { Inject, Injectable, Logger } from '@nestjs/common';
import type { DatabaseClient, Prisma } from '@church/database';
import { JobProducer } from '@church/infrastructure/queue';
import {
  type AdminMembershipList,
  type AdminMembershipQuery,
  type AdminMembershipRow,
  branchTarget,
  type MembershipDecision,
} from '@church/shared';
import type { z } from 'zod';
import { Errors } from '../../common/http/errors.js';
import type { Principal, RequestMeta } from '../../common/principal.js';
import { DATABASE } from '../../infrastructure/tokens.js';
import { AccessService } from '../access/access.service.js';
import { AuditService } from '../core/audit.service.js';
import { OrganizationService } from '../core/organization.service.js';
import { inScope, PERSON_SELECT, personName, personRef } from './people.js';

const ROW_SELECT = {
  id: true,
  status: true,
  message: true,
  decisionNote: true,
  requestedAt: true,
  decidedAt: true,
  branchId: true,
  user: { select: PERSON_SELECT },
  branch: { select: { id: true, slug: true, name: true } },
  decidedBy: { select: PERSON_SELECT },
} satisfies Prisma.BranchMembershipSelect;

type Row = Prisma.BranchMembershipGetPayload<{ select: typeof ROW_SELECT }>;

function toRow(row: Row): AdminMembershipRow {
  return {
    id: row.id,
    person: personRef(row.user),
    branch: row.branch,
    status: row.status,
    message: row.message,
    decisionNote: row.decisionNote,
    requestedAt: row.requestedAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    decidedBy: row.decidedBy ? personName(row.decidedBy) : null,
  };
}

/** Branch membership review, limited to the branches where the reviewer holds the permission. */
@Injectable()
export class AdminMembershipsService {
  private readonly logger = new Logger(AdminMembershipsService.name);

  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly organizations: OrganizationService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly jobs: JobProducer,
  ) {}

  async list(
    principal: Principal,
    query: z.output<typeof AdminMembershipQuery>,
  ): Promise<AdminMembershipList> {
    const organizationId = await this.organizations.currentId();
    const where: Prisma.BranchMembershipWhereInput = {
      ...inScope(this.access.scopeOf(principal, 'membership.review')),
      branch: { organizationId, deletedAt: null, ...(query.branch ? { slug: query.branch } : {}) },
      ...(query.status ? { status: query.status } : {}),
    };
    const [total, rows] = await Promise.all([
      this.db.branchMembership.count({ where }),
      this.db.branchMembership.findMany({
        where,
        select: ROW_SELECT,
        orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items: rows.map(toRow), page: query.page, pageSize: query.pageSize, total };
  }

  async decide(
    principal: Principal,
    id: string,
    input: z.output<typeof MembershipDecision>,
    meta: RequestMeta,
  ): Promise<AdminMembershipRow> {
    const organizationId = await this.organizations.currentId();
    const current = await this.db.branchMembership.findFirst({
      where: { id, branch: { organizationId, deletedAt: null } },
      select: { id: true, status: true, userId: true, branchId: true },
    });
    if (
      !current ||
      !this.access.can(principal, 'membership.review', branchTarget(current.branchId))
    ) {
      throw Errors.notFound('That membership');
    }
    const expected = input.decision === 'REMOVE' ? 'ACTIVE' : 'PENDING';
    if (current.status !== expected) {
      throw Errors.conflict(
        'MEMBERSHIP_STATE',
        'This request has already been handled. Refresh to see its current state.',
      );
    }
    if (input.decision === 'REMOVE' && current.userId === principal.userId) {
      throw Errors.forbidden(
        'You cannot remove yourself. Leave the branch from your account instead.',
      );
    }
    const now = new Date();
    const data: Prisma.BranchMembershipUpdateInput =
      input.decision === 'APPROVE'
        ? { status: 'ACTIVE', decidedAt: now, decisionNote: input.note ?? null }
        : input.decision === 'REJECT'
          ? {
              status: 'REJECTED',
              isPrimary: false,
              decidedAt: now,
              decisionNote: input.note ?? null,
            }
          : { status: 'LEFT', isPrimary: false, decidedAt: now, decisionNote: input.note ?? null };

    const row = await this.db.$transaction(async (tx) => {
      const updated = await tx.branchMembership.update({
        where: { id },
        data: { ...data, decidedBy: { connect: { id: principal.userId } } },
        select: ROW_SELECT,
      });
      if (input.decision === 'APPROVE') {
        // A new member's home branch defaults to the branch that accepted them.
        await tx.profile.updateMany({
          where: { userId: current.userId, homeBranchId: null },
          data: { homeBranchId: current.branchId },
        });
      }
      await this.audit.record(
        {
          organizationId,
          actorId: principal.userId,
          action: `membership.${input.decision.toLowerCase()}`,
          entityType: 'BranchMembership',
          entityId: id,
          branchId: current.branchId,
          summary: personName(updated.user),
          meta,
        },
        tx,
      );
      return updated;
    });
    if (input.decision !== 'REMOVE') {
      await this.jobs
        .enqueue('membershipDecided', { membershipId: id, requestId: meta.requestId })
        .catch((error: unknown) =>
          this.logger.error({ err: error }, 'Could not enqueue membership notification'),
        );
    }
    return toRow(row);
  }
}
