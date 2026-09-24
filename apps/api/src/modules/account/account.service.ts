import { Inject, Injectable, Logger } from '@nestjs/common';
import type { DatabaseClient, Prisma } from '@church/database';
import { JobProducer } from '@church/infrastructure/queue';
import {
  type AccountProfile,
  MANDATORY_EMAIL_CATEGORIES,
  type MembershipDto,
  type MembershipRequest,
  NotificationCategory,
  type NotificationPreferences,
  type UpdateNotificationPreferences,
  type UpdateProfileRequest,
} from '@church/shared';
import type { z } from 'zod';
import { Errors } from '../../common/http/errors.js';
import type { Principal, RequestMeta } from '../../common/principal.js';
import { DATABASE } from '../../infrastructure/tokens.js';
import { BranchQueryService } from '../branches/branch-query.service.js';
import { AuditService, diffFields } from '../core/audit.service.js';
import { MEDIA_URL_SELECT, MediaUrlService } from '../core/media-urls.service.js';
import { OrganizationService } from '../core/organization.service.js';

const MEMBERSHIP_SELECT = {
  id: true,
  status: true,
  isPrimary: true,
  message: true,
  decisionNote: true,
  requestedAt: true,
  decidedAt: true,
  branch: { select: { id: true, slug: true, name: true } },
} satisfies Prisma.BranchMembershipSelect;

type MembershipRow = Prisma.BranchMembershipGetPayload<{ select: typeof MEMBERSHIP_SELECT }>;

function toMembership(row: MembershipRow): MembershipDto {
  return {
    id: row.id,
    branch: row.branch,
    status: row.status,
    isPrimary: row.isPrimary,
    message: row.message,
    decisionNote: row.decisionNote,
    requestedAt: row.requestedAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
  };
}

/** The signed-in member's own account. Every method acts on `principal.userId` only. */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly organizations: OrganizationService,
    private readonly branches: BranchQueryService,
    private readonly media: MediaUrlService,
    private readonly audit: AuditService,
    private readonly jobs: JobProducer,
  ) {}

  async profile(principal: Principal): Promise<AccountProfile> {
    const user = await this.db.user.findUnique({
      where: { id: principal.userId },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
        createdAt: true,
        profile: {
          select: {
            firstName: true,
            lastName: true,
            displayName: true,
            phone: true,
            bio: true,
            avatarMedia: { select: MEDIA_URL_SELECT },
            homeBranch: {
              select: { id: true, slug: true, name: true, deletedAt: true, status: true },
            },
          },
        },
        memberships: {
          where: { branch: { deletedAt: null } },
          orderBy: { requestedAt: 'desc' },
          select: MEMBERSHIP_SELECT,
        },
      },
    });
    if (!user) throw Errors.unauthenticated();
    const home = user.profile?.homeBranch;
    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerifiedAt !== null,
      firstName: user.profile?.firstName ?? '',
      lastName: user.profile?.lastName ?? '',
      displayName: user.profile?.displayName ?? null,
      phone: user.profile?.phone ?? null,
      bio: user.profile?.bio ?? null,
      avatarUrl: this.media.imageUrl(user.profile?.avatarMedia, 160),
      homeBranch:
        home && !home.deletedAt && home.status === 'ACTIVE'
          ? { id: home.id, slug: home.slug, name: home.name }
          : null,
      memberships: user.memberships.map(toMembership),
      createdAt: user.createdAt.toISOString(),
    };
  }

  async updateProfile(
    principal: Principal,
    input: z.output<typeof UpdateProfileRequest>,
    meta: RequestMeta,
  ): Promise<AccountProfile> {
    const organization = await this.organizations.current();
    const homeBranchId =
      input.homeBranch === undefined
        ? undefined
        : input.homeBranch === null
          ? null
          : (await this.branches.resolveRef(organization.id, input.homeBranch)).id;
    const data = {
      firstName: input.firstName,
      lastName: input.lastName,
      displayName: input.displayName,
      phone: input.phone,
      bio: input.bio,
      homeBranchId,
    };
    const before = await this.db.profile.findUnique({
      where: { userId: principal.userId },
      select: {
        firstName: true,
        lastName: true,
        displayName: true,
        phone: true,
        bio: true,
        homeBranchId: true,
      },
    });
    if (!before) throw Errors.notFound('Your profile');
    const changes = diffFields(before, data);
    if (Object.keys(changes).length > 0) {
      await this.db.profile.update({ where: { userId: principal.userId }, data });
      await this.audit.record({
        organizationId: organization.id,
        actorId: principal.userId,
        action: 'profile.update',
        entityType: 'User',
        entityId: principal.userId,
        // Personal details are not copied into the audit log; field names are enough.
        changes: Object.fromEntries(
          Object.keys(changes).map((key) => [key, { from: '[changed]', to: '[changed]' }]),
        ),
        meta,
      });
    }
    return this.profile(principal);
  }

  /**
   * Ask to join a branch. A member belongs to one branch at a time: an active or pending
   * membership elsewhere must be left first. Re-asking after leaving or being declined
   * reopens the same record.
   */
  async requestMembership(
    principal: Principal,
    input: z.output<typeof MembershipRequest>,
    meta: RequestMeta,
  ): Promise<MembershipDto> {
    if (!principal.emailVerified)
      throw Errors.forbidden('Please confirm your e-mail address first.', 'EMAIL_NOT_VERIFIED');
    const organization = await this.organizations.current();
    const branch = await this.branches.resolveRef(organization.id, input.branch);

    const current = await this.db.branchMembership.findFirst({
      where: { userId: principal.userId, isPrimary: true, status: { in: ['PENDING', 'ACTIVE'] } },
      select: { branchId: true, status: true, branch: { select: { name: true } } },
    });
    if (current) {
      if (current.branchId === branch.id) {
        throw Errors.conflict(
          'MEMBERSHIP_EXISTS',
          current.status === 'ACTIVE'
            ? `You are already a member of ${branch.name}.`
            : `Your request to join ${branch.name} is waiting for review.`,
        );
      }
      throw Errors.conflict(
        'MEMBERSHIP_ELSEWHERE',
        `You are ${current.status === 'ACTIVE' ? 'a member of' : 'waiting to join'} ${current.branch.name}. Leave that branch first.`,
      );
    }

    const membership = await this.db.branchMembership.upsert({
      where: { userId_branchId: { userId: principal.userId, branchId: branch.id } },
      create: {
        userId: principal.userId,
        branchId: branch.id,
        status: 'PENDING',
        isPrimary: true,
        message: input.message ?? null,
      },
      update: {
        status: 'PENDING',
        isPrimary: true,
        message: input.message ?? null,
        requestedAt: new Date(),
        decidedAt: null,
        decidedById: null,
        decisionNote: null,
      },
      select: MEMBERSHIP_SELECT,
    });
    await this.audit.record({
      organizationId: organization.id,
      actorId: principal.userId,
      action: 'membership.request',
      entityType: 'BranchMembership',
      entityId: membership.id,
      branchId: branch.id,
      meta,
    });
    await this.jobs
      .enqueue('membershipRequested', { membershipId: membership.id, requestId: meta.requestId })
      .catch((error: unknown) =>
        this.logger.error({ err: error }, 'Could not enqueue membership notification'),
      );
    return toMembership(membership);
  }

  /** Withdraw a pending request or leave a branch. */
  async leaveMembership(
    principal: Principal,
    membershipId: string,
    meta: RequestMeta,
  ): Promise<MembershipDto> {
    const existing = await this.db.branchMembership.findFirst({
      where: { id: membershipId, userId: principal.userId },
      select: { id: true, status: true, branchId: true },
    });
    if (!existing || (existing.status !== 'PENDING' && existing.status !== 'ACTIVE'))
      throw Errors.notFound('That membership');
    const membership = await this.db.branchMembership.update({
      where: { id: existing.id },
      data: {
        status: 'LEFT',
        isPrimary: false,
        decidedAt: new Date(),
        decidedById: principal.userId,
      },
      select: MEMBERSHIP_SELECT,
    });
    await this.audit.record({
      organizationId: (await this.organizations.current()).id,
      actorId: principal.userId,
      action: existing.status === 'PENDING' ? 'membership.withdraw' : 'membership.leave',
      entityType: 'BranchMembership',
      entityId: membership.id,
      branchId: existing.branchId,
      meta,
    });
    return toMembership(membership);
  }

  /** Every category, with the organisation defaults where the member has not chosen. */
  async preferences(principal: Principal): Promise<NotificationPreferences> {
    const [organization, rows] = await Promise.all([
      this.organizations.current(),
      this.db.notificationPreference.findMany({ where: { userId: principal.userId } }),
    ]);
    const settings = organization.parsedSettings;
    const chosen = new Map(rows.map((r) => [r.category, r]));
    return {
      items: NotificationCategory.values.map((category) => {
        const row = chosen.get(category);
        const mandatoryEmail = (MANDATORY_EMAIL_CATEGORIES as readonly string[]).includes(category);
        return {
          category,
          inApp: row?.inApp ?? settings.defaultInAppCategories.includes(category),
          email:
            mandatoryEmail || (row?.email ?? settings.defaultEmailCategories.includes(category)),
        };
      }),
    };
  }

  async updatePreferences(
    principal: Principal,
    input: z.output<typeof UpdateNotificationPreferences>,
  ): Promise<NotificationPreferences> {
    await this.db.$transaction(
      input.items.map((item) => {
        const email = (MANDATORY_EMAIL_CATEGORIES as readonly string[]).includes(item.category)
          ? true
          : item.email;
        return this.db.notificationPreference.upsert({
          where: { userId_category: { userId: principal.userId, category: item.category } },
          create: { userId: principal.userId, category: item.category, inApp: item.inApp, email },
          update: { inApp: item.inApp, email },
        });
      }),
    );
    return this.preferences(principal);
  }
}
