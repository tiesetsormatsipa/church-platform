import { Inject, Injectable, Logger } from '@nestjs/common';
import type { DatabaseClient, Prisma } from '@church/database';
import { JobProducer } from '@church/infrastructure/queue';
import {
  type AdminOrganization,
  type AdminSummary,
  type AuditList,
  type AuditQuery,
  CacheTags,
  canAnywhere,
  type OrganizationSettingsInput,
  parseOrganizationSettings,
  scopeOf,
} from '@church/shared';
import type { z } from 'zod';
import type { Principal, RequestMeta } from '../../common/principal.js';
import { DATABASE } from '../../infrastructure/tokens.js';
import { PERSON_SELECT, personRef } from '../admin-people/people.js';
import { AuditService, diffFields } from '../core/audit.service.js';
import { OrganizationService } from '../core/organization.service.js';

function inScope(scope: 'ALL' | string[]) {
  return scope === 'ALL' ? {} : { branchId: { in: scope } };
}

/** Dashboard summary, audit log and organisation settings. */
@Injectable()
export class AdminOrgService {
  private readonly logger = new Logger(AdminOrgService.name);

  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly organizations: OrganizationService,
    private readonly audit: AuditService,
    private readonly jobs: JobProducer,
  ) {}

  async summary(principal: Principal): Promise<AdminSummary> {
    const organizationId = await this.organizations.currentId();
    const g = principal.grants;
    const areas = {
      content: canAnywhere(g, 'content.create'),
      memberships: canAnywhere(g, 'membership.review'),
      people: canAnywhere(g, 'user.read') || canAnywhere(g, 'role.assign'),
      branches: canAnywhere(g, 'branch.update'),
      audit: canAnywhere(g, 'audit.read'),
      settings: canAnywhere(g, 'settings.manage'),
    };
    const zero = Promise.resolve(0);
    const publishScope = scopeOf(g, 'content.publish');
    const contentScope = scopeOf(g, 'content.create');
    const [contentAwaitingReview, myDrafts, pendingMemberships, upcomingEvents] = await Promise.all(
      [
        areas.content && (publishScope === 'ALL' || publishScope.length > 0)
          ? this.db.contentItem.count({
              where: {
                organizationId,
                deletedAt: null,
                status: 'PENDING_REVIEW',
                ...inScope(publishScope),
              },
            })
          : zero,
        areas.content
          ? this.db.contentItem.count({
              where: {
                organizationId,
                deletedAt: null,
                status: 'DRAFT',
                createdById: principal.userId,
              },
            })
          : zero,
        areas.memberships
          ? this.db.branchMembership.count({
              where: {
                status: 'PENDING',
                branch: { organizationId, deletedAt: null },
                ...inScope(scopeOf(g, 'membership.review')),
              },
            })
          : zero,
        areas.content
          ? this.db.contentItem.count({
              where: {
                organizationId,
                deletedAt: null,
                status: 'PUBLISHED',
                type: 'EVENT',
                event: { startsAt: { gte: new Date() } },
                ...(contentScope === 'ALL'
                  ? {}
                  : { OR: [{ scope: 'GLOBAL' }, { branchId: { in: contentScope } }] }),
              },
            })
          : zero,
      ],
    );
    return {
      areas,
      counts: {
        contentAwaitingReview,
        myDrafts,
        pendingMemberships,
        upcomingEvents,
      },
    };
  }

  async auditLog(query: z.output<typeof AuditQuery>): Promise<AuditList> {
    const organizationId = await this.organizations.currentId();
    const where: Prisma.AuditLogWhereInput = {
      organizationId,
      ...(query.action ? { action: { startsWith: query.action } } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.actor ? { actorId: query.actor } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(`${query.from}T00:00:00Z`) } : {}),
              ...(query.to
                ? { lt: new Date(new Date(`${query.to}T00:00:00Z`).getTime() + 86_400_000) }
                : {}),
            },
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.db.auditLog.count({ where }),
      this.db.auditLog.findMany({
        where,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          summary: true,
          changes: true,
          ipAddress: true,
          requestId: true,
          createdAt: true,
          actor: { select: PERSON_SELECT },
          branch: { select: { id: true, slug: true, name: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      items: rows.map((r) => ({
        ...r,
        actor: r.actor ? personRef(r.actor) : null,
        changes: (r.changes as Record<string, { from: unknown; to: unknown }> | null) ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async settings(): Promise<AdminOrganization> {
    const org = await this.organizations.current();
    const s = org.parsedSettings;
    return {
      name: org.name,
      shortName: org.shortName,
      tagline: org.tagline,
      description: org.description,
      email: org.email,
      phone: org.phone,
      websiteUrl: org.websiteUrl,
      timezone: org.timezone,
      registrationOpen: s.registrationOpen,
      defaultInAppCategories: s.defaultInAppCategories,
      defaultEmailCategories: s.defaultEmailCategories,
      socialLinks: {
        facebook: s.socialLinks.facebook ?? null,
        youtube: s.socialLinks.youtube ?? null,
        instagram: s.socialLinks.instagram ?? null,
        x: s.socialLinks.x ?? null,
      },
    };
  }

  async updateSettings(
    principal: Principal,
    input: z.output<typeof OrganizationSettingsInput>,
    meta: RequestMeta,
  ): Promise<AdminOrganization> {
    const org = await this.organizations.current();
    const before = await this.settings();
    const socialLinks = Object.fromEntries(
      Object.entries(input.socialLinks).filter(([, v]) => Boolean(v)),
    );
    const settings = parseOrganizationSettings({
      ...(org.settings as Record<string, unknown>),
      registrationOpen: input.registrationOpen,
      defaultInAppCategories: input.defaultInAppCategories,
      defaultEmailCategories: input.defaultEmailCategories,
      socialLinks,
    });
    await this.db.organization.update({
      where: { id: org.id },
      data: {
        name: input.name,
        shortName: input.shortName ?? null,
        tagline: input.tagline ?? null,
        description: input.description ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        websiteUrl: input.websiteUrl ?? null,
        timezone: input.timezone,
        settings,
      },
    });
    this.organizations.invalidate();
    const after = await this.settings();
    await this.audit.record({
      organizationId: org.id,
      actorId: principal.userId,
      action: 'settings.update',
      entityType: 'Organization',
      entityId: org.id,
      changes: diffFields(
        {
          ...before,
          socialLinks: JSON.stringify(before.socialLinks),
          defaultInAppCategories: before.defaultInAppCategories.join(','),
          defaultEmailCategories: before.defaultEmailCategories.join(','),
        },
        {
          ...after,
          socialLinks: JSON.stringify(after.socialLinks),
          defaultInAppCategories: after.defaultInAppCategories.join(','),
          defaultEmailCategories: after.defaultEmailCategories.join(','),
        },
      ),
      meta,
    });
    void this.jobs
      .enqueue('revalidateWeb', { tags: [CacheTags.organization], requestId: meta.requestId })
      .catch((error: unknown) =>
        this.logger.warn({ err: error }, 'Could not enqueue cache revalidation'),
      );
    return after;
  }
}
