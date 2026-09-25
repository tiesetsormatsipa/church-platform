import { Inject, Injectable, Logger } from '@nestjs/common';
import type { DatabaseClient, DbExecutor, Prisma } from '@church/database';
import { JobProducer } from '@church/infrastructure/queue';
import {
  type AdminContentDetail,
  type AdminContentList,
  type AdminContentQuery,
  type AdminContentRow,
  CacheTags,
  type ContentEditorOptions,
  type ContentInput,
  contentPath,
  contentRights,
  type ContentRights,
  type Permission,
  scopeOf,
  type SeriesInput,
  slugify,
  type SpeakerInput,
  uniqueSlug,
} from '@church/shared';
import type { z } from 'zod';
import { Errors } from '../../common/http/errors.js';
import type { Principal, RequestMeta } from '../../common/principal.js';
import { DATABASE } from '../../infrastructure/tokens.js';
import { AccessService } from '../access/access.service.js';
import { BranchQueryService } from '../branches/branch-query.service.js';
import { AuditService, diffFields } from '../core/audit.service.js';
import { OrganizationService } from '../core/organization.service.js';
import { isoDate } from '../content/content.mapper.js';
import {
  ADMIN_CONTENT_DETAIL_SELECT,
  ADMIN_CONTENT_ROW_SELECT,
  type AdminContentDetailData,
  type AdminContentRowData,
  displayName,
} from './admin-content.select.js';

type Input = z.output<typeof ContentInput>;

const CONTENT_PERMISSIONS: Permission[] = [
  'content.create',
  'content.update',
  'content.publish',
  'content.archive',
];

function dateOnly(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : new Date(`${value}T00:00:00Z`);
}

/**
 * Content administration. Visibility and every action are checked against the item's
 * target (its branch, or the whole church for church-wide content) with `contentRights`.
 */
@Injectable()
export class AdminContentService {
  private readonly logger = new Logger(AdminContentService.name);

  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly organizations: OrganizationService,
    private readonly branches: BranchQueryService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly jobs: JobProducer,
  ) {}

  // ---------------------------------------------------------------------------------------
  // Reading
  // ---------------------------------------------------------------------------------------

  /** Rows the principal may see: everything for church-wide roles, else their branches. */
  private visibility(principal: Principal): Prisma.ContentItemWhereInput {
    const branchIds = new Set<string>();
    for (const permission of CONTENT_PERMISSIONS) {
      const scope = scopeOf(principal.grants, permission);
      if (scope === 'ALL') return {};
      for (const id of scope) branchIds.add(id);
    }
    return { OR: [{ branchId: { in: [...branchIds] } }, { createdById: principal.userId }] };
  }

  private rights(principal: Principal, row: AdminContentRowData): ContentRights {
    return contentRights(principal.grants, principal.userId, row);
  }

  private row(principal: Principal, row: AdminContentRowData): AdminContentRow {
    return {
      id: row.id,
      type: row.type,
      slug: row.slug,
      path: contentPath(row.type, row.slug),
      title: row.title,
      status: row.status,
      scope: row.scope,
      branch: row.branch,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
      createdBy: displayName(row.createdBy),
      isPinned: row.isPinned,
      isFeatured: row.isFeatured,
      eventStartsAt: row.event?.startsAt.toISOString() ?? null,
      rights: this.rights(principal, row),
    };
  }

  async list(
    principal: Principal,
    query: z.output<typeof AdminContentQuery>,
  ): Promise<AdminContentList> {
    const organizationId = await this.organizations.currentId();
    const filters: Prisma.ContentItemWhereInput[] = [
      { organizationId, deletedAt: null },
      this.visibility(principal),
    ];
    if (query.status) filters.push({ status: query.status });
    if (query.type) filters.push({ type: query.type });
    if (query.branch === 'global') filters.push({ scope: 'GLOBAL' });
    else if (query.branch) filters.push({ branch: { slug: query.branch } });
    if (query.mine) filters.push({ createdById: principal.userId });
    if (query.q) filters.push({ title: { contains: query.q, mode: 'insensitive' } });
    const where: Prisma.ContentItemWhereInput = { AND: filters };

    const [total, rows] = await Promise.all([
      this.db.contentItem.count({ where }),
      this.db.contentItem.findMany({
        where,
        select: ADMIN_CONTENT_ROW_SELECT,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      items: rows.map((r) => this.row(principal, r)),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  private async load(principal: Principal, id: string): Promise<AdminContentDetailData> {
    const organizationId = await this.organizations.currentId();
    const row = await this.db.contentItem.findFirst({
      where: { AND: [{ id, organizationId, deletedAt: null }, this.visibility(principal)] },
      select: ADMIN_CONTENT_DETAIL_SELECT,
    });
    if (!row) throw Errors.notFound('That item');
    return row;
  }

  private detail(principal: Principal, row: AdminContentDetailData): AdminContentDetail {
    return {
      ...this.row(principal, row),
      slugLocked: row.publishedAt !== null,
      summary: row.summary,
      body: row.body,
      authorName: row.authorName,
      pinnedUntil: row.pinnedUntil?.toISOString() ?? null,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      tags: row.tags.map((t) => t.tag.name),
      event: row.event
        ? {
            ...row.event,
            startsAt: row.event.startsAt.toISOString(),
            endsAt: row.event.endsAt?.toISOString() ?? null,
          }
        : null,
      sermon: row.sermon
        ? {
            preachedOn: isoDate(row.sermon.preachedOn) as string,
            speaker: row.sermon.speaker?.slug ?? null,
            speakerName: row.sermon.speakerName,
            series: row.sermon.series?.slug ?? null,
            scripture: row.sermon.scripture,
            externalVideoUrl: row.sermon.externalVideoUrl,
            durationSeconds: row.sermon.durationSeconds,
            language: row.sermon.language,
            transcript: row.sermon.transcript,
          }
        : null,
      baptism: row.baptism
        ? { ...row.baptism, baptismDate: isoDate(row.baptism.baptismDate) }
        : null,
      createdBy: displayName(row.createdBy),
      updatedBy: displayName(row.updatedBy),
      createdAt: row.createdAt.toISOString(),
    };
  }

  async get(principal: Principal, id: string): Promise<AdminContentDetail> {
    return this.detail(principal, await this.load(principal, id));
  }

  async options(principal: Principal): Promise<ContentEditorOptions> {
    const organizationId = await this.organizations.currentId();
    const scope = scopeOf(principal.grants, 'content.create');
    const [branches, speakers, series, tags] = await Promise.all([
      this.db.branch.findMany({
        where: {
          organizationId,
          deletedAt: null,
          status: 'ACTIVE',
          ...(scope === 'ALL' ? {} : { id: { in: scope } }),
        },
        select: { id: true, slug: true, name: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.db.speaker.findMany({
        where: { organizationId },
        select: { slug: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.db.sermonSeries.findMany({
        where: { organizationId },
        select: { slug: true, title: true },
        orderBy: { title: 'asc' },
      }),
      this.db.tag.findMany({
        where: { organizationId },
        select: { name: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return {
      canCreateGlobal: scope === 'ALL',
      branches,
      speakers,
      series,
      tags: tags.map((t) => t.name),
    };
  }

  // ---------------------------------------------------------------------------------------
  // Writing
  // ---------------------------------------------------------------------------------------

  /** Resolve the scope and branch slug of the input to a content target. */
  private async resolveTarget(
    organizationId: string,
    input: Pick<Input, 'scope' | 'branch'>,
  ): Promise<{ scope: 'GLOBAL' | 'BRANCH'; branchId: string | null }> {
    const branchId =
      input.scope === 'BRANCH' && input.branch
        ? (await this.branches.resolveRef(organizationId, input.branch)).id
        : null;
    return { scope: input.scope, branchId };
  }

  private async slugFor(organizationId: string, base: string, exceptId?: string): Promise<string> {
    return uniqueSlug(base, async (candidate) => {
      const existing = await this.db.contentItem.findFirst({
        where: { organizationId, slug: candidate, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
        select: { id: true },
      });
      return existing !== null;
    });
  }

  private async lookupSlug(
    table: 'speaker' | 'sermonSeries',
    organizationId: string,
    slug: string | null | undefined,
  ): Promise<string | null> {
    if (!slug) return null;
    const row =
      table === 'speaker'
        ? await this.db.speaker.findFirst({ where: { organizationId, slug }, select: { id: true } })
        : await this.db.sermonSeries.findFirst({
            where: { organizationId, slug },
            select: { id: true },
          });
    if (!row) {
      throw Errors.validation([
        {
          path: `sermon.${table === 'speaker' ? 'speaker' : 'series'}`,
          message: 'Choose one from the list',
        },
      ]);
    }
    return row.id;
  }

  private async saveTags(
    tx: DbExecutor,
    organizationId: string,
    contentId: string,
    names: string[],
  ) {
    await tx.contentTag.deleteMany({ where: { contentId } });
    const unique = new Map(names.map((name) => [slugify(name, 'tag'), name.trim()]));
    for (const [slug, name] of unique) {
      const tag = await tx.tag.upsert({
        where: { organizationId_slug: { organizationId, slug } },
        create: { organizationId, slug, name },
        update: {},
        select: { id: true },
      });
      await tx.contentTag.create({ data: { contentId, tagId: tag.id } });
    }
  }

  private async saveDetails(
    tx: DbExecutor,
    organizationId: string,
    contentId: string,
    input: Input,
  ) {
    if (input.type === 'EVENT' && input.event) {
      const e = input.event;
      const data = {
        startsAt: new Date(e.startsAt),
        endsAt: e.endsAt ? new Date(e.endsAt) : null,
        allDay: e.allDay,
        timezone: e.timezone,
        category: e.category,
        eventStatus: e.eventStatus,
        statusNote: e.statusNote ?? null,
        venueName: e.venueName ?? null,
        venueAddress: e.venueAddress ?? null,
        mapsUrl: e.mapsUrl ?? null,
        onlineUrl: e.onlineUrl ?? null,
        registrationUrl: e.registrationUrl ?? null,
      };
      await tx.eventDetail.upsert({
        where: { contentId },
        create: { contentId, ...data },
        update: data,
      });
    }
    if (input.type === 'SERMON' && input.sermon) {
      const s = input.sermon;
      const data = {
        preachedOn: dateOnly(s.preachedOn) as Date,
        speakerId: await this.lookupSlug('speaker', organizationId, s.speaker),
        speakerName: s.speakerName ?? null,
        seriesId: await this.lookupSlug('sermonSeries', organizationId, s.series),
        scripture: s.scripture ?? null,
        externalVideoUrl: s.externalVideoUrl ?? null,
        durationSeconds: s.durationSeconds ?? null,
        language: s.language,
        transcript: s.transcript ?? null,
      };
      await tx.sermonDetail.upsert({
        where: { contentId },
        create: { contentId, ...data },
        update: data,
      });
    }
    if (input.type === 'BAPTISM' && input.baptism) {
      const b = input.baptism;
      const data = {
        baptismDate: dateOnly(b.baptismDate) ?? null,
        candidatesCount: b.candidatesCount ?? null,
        officiantName: b.officiantName ?? null,
        location: b.location ?? null,
      };
      await tx.baptismDetail.upsert({
        where: { contentId },
        create: { contentId, ...data },
        update: data,
      });
    }
  }

  private coreData(input: Input) {
    return {
      title: input.title,
      summary: input.summary ?? null,
      body: input.body ?? null,
      authorName: input.authorName ?? null,
      seoTitle: input.seoTitle ?? null,
      seoDescription: input.seoDescription ?? null,
    };
  }

  private assertFlags(
    principal: Principal,
    target: { scope: 'GLOBAL' | 'BRANCH'; branchId: string | null },
    input: Input,
    current?: { isPinned: boolean; isFeatured: boolean; pinnedUntil: Date | null },
  ): void {
    const changed =
      input.isPinned !== (current?.isPinned ?? false) ||
      input.isFeatured !== (current?.isFeatured ?? false) ||
      (input.pinnedUntil ?? null) !== (current?.pinnedUntil?.toISOString() ?? null);
    if (changed) this.access.assertContent(principal, 'content.publish', target);
  }

  async create(principal: Principal, input: Input, meta: RequestMeta): Promise<AdminContentDetail> {
    const organizationId = await this.organizations.currentId();
    const target = await this.resolveTarget(organizationId, input);
    this.access.assertContent(principal, 'content.create', { ...target, type: input.type });
    this.assertFlags(principal, target, input);
    const slug = await this.slugFor(organizationId, input.slug ?? input.title);

    const id = await this.db.$transaction(async (tx) => {
      const created = await tx.contentItem.create({
        data: {
          organizationId,
          type: input.type,
          ...target,
          slug,
          ...this.coreData(input),
          status: 'DRAFT',
          isPinned: input.isPinned,
          pinnedUntil: input.pinnedUntil ? new Date(input.pinnedUntil) : null,
          isFeatured: input.isFeatured,
          authorId: principal.userId,
          createdById: principal.userId,
          updatedById: principal.userId,
        },
        select: { id: true },
      });
      await this.saveDetails(tx, organizationId, created.id, input);
      await this.saveTags(tx, organizationId, created.id, input.tags);
      await this.audit.record(
        {
          organizationId,
          actorId: principal.userId,
          action: 'content.create',
          entityType: 'ContentItem',
          entityId: created.id,
          branchId: target.branchId,
          summary: `${input.type} "${input.title}"`,
          meta,
        },
        tx,
      );
      return created.id;
    });
    return this.get(principal, id);
  }

  async update(
    principal: Principal,
    id: string,
    input: Input,
    meta: RequestMeta,
  ): Promise<AdminContentDetail> {
    const organizationId = await this.organizations.currentId();
    const current = await this.load(principal, id);
    if (!this.rights(principal, current).edit) throw Errors.forbidden('You cannot edit this item.');
    if (input.type !== current.type) {
      throw Errors.validation([{ path: 'type', message: 'The kind of content cannot be changed' }]);
    }
    const target = await this.resolveTarget(organizationId, input);
    const moved = target.scope !== current.scope || target.branchId !== current.branchId;
    if (moved) {
      // Moving content needs the right to create it at the new place, and published
      // content may only be moved by someone who can publish at both places.
      this.access.assertContent(principal, 'content.create', { ...target, type: input.type });
      if (current.status === 'PUBLISHED') {
        this.access.assertContent(principal, 'content.publish', current);
        this.access.assertContent(principal, 'content.publish', target);
      }
    }
    this.assertFlags(principal, target, input, current);

    let slug = current.slug;
    if (input.slug && input.slug !== current.slug) {
      if (current.publishedAt) {
        throw Errors.conflict(
          'SLUG_LOCKED',
          'The address of published content cannot change, so links keep working.',
        );
      }
      slug = await this.slugFor(organizationId, input.slug, id);
    }

    const data = {
      ...this.coreData(input),
      ...target,
      slug,
      isPinned: input.isPinned,
      pinnedUntil: input.pinnedUntil ? new Date(input.pinnedUntil) : null,
      isFeatured: input.isFeatured,
    };
    await this.db.$transaction(async (tx) => {
      await tx.contentItem.update({
        where: { id },
        data: { ...data, updatedById: principal.userId },
      });
      await this.saveDetails(tx, organizationId, id, input);
      await this.saveTags(tx, organizationId, id, input.tags);
      await this.audit.record(
        {
          organizationId,
          actorId: principal.userId,
          action: 'content.update',
          entityType: 'ContentItem',
          entityId: id,
          branchId: target.branchId,
          changes: diffFields(
            {
              title: current.title,
              summary: current.summary,
              slug: current.slug,
              scope: current.scope,
              branchId: current.branchId,
              isPinned: current.isPinned,
              isFeatured: current.isFeatured,
            },
            {
              title: data.title,
              summary: data.summary,
              slug,
              scope: data.scope,
              branchId: data.branchId,
              isPinned: data.isPinned,
              isFeatured: data.isFeatured,
            },
          ),
          meta,
        },
        tx,
      );
    });
    if (current.status === 'PUBLISHED') this.revalidate([slug, current.slug], meta);
    return this.get(principal, id);
  }

  // ---------------------------------------------------------------------------------------
  // Workflow
  // ---------------------------------------------------------------------------------------

  private async transition(
    principal: Principal,
    id: string,
    action: 'submit' | 'publish' | 'unpublish' | 'archive',
    meta: RequestMeta,
    publishAt?: string | null,
  ): Promise<AdminContentDetail> {
    const current = await this.load(principal, id);
    const rights = this.rights(principal, current);
    const now = new Date();
    let data: Prisma.ContentItemUpdateInput;
    switch (action) {
      case 'submit':
        if (!rights.submit)
          throw Errors.forbidden('Only your own drafts can be submitted for review.');
        data = { status: 'PENDING_REVIEW' };
        break;
      case 'publish': {
        if (!rights.publish) throw Errors.forbidden('You cannot publish this item.');
        if (current.status === 'ARCHIVED') {
          throw Errors.conflict(
            'CONTENT_ARCHIVED',
            'Restore archived content as a draft before publishing it.',
          );
        }
        // A future time schedules the item; otherwise it goes live now (re-publishing keeps
        // the original date so the feed order does not change).
        const at = publishAt ? new Date(publishAt) : null;
        let publishedAt = now;
        if (at && at > now) publishedAt = at;
        else if (!at && current.status === 'PUBLISHED' && current.publishedAt)
          publishedAt = current.publishedAt;
        data = {
          status: 'PUBLISHED',
          publishedAt,
          publishedBy: { connect: { id: principal.userId } },
        };
        break;
      }
      case 'unpublish':
        if (!rights.publish) throw Errors.forbidden('You cannot unpublish this item.');
        data = { status: 'DRAFT' };
        break;
      case 'archive':
        if (!rights.archive) throw Errors.forbidden('You cannot archive this item.');
        data = { status: 'ARCHIVED', isPinned: false, isFeatured: false };
        break;
    }
    await this.db.contentItem.update({
      where: { id },
      data: { ...data, updatedBy: { connect: { id: principal.userId } } },
    });
    await this.audit.record({
      organizationId: await this.organizations.currentId(),
      actorId: principal.userId,
      action: `content.${action}`,
      entityType: 'ContentItem',
      entityId: id,
      branchId: current.branchId,
      summary: current.title,
      meta,
    });
    if (action !== 'submit') this.revalidate([current.slug], meta);
    if (action === 'publish') {
      await this.jobs
        .enqueue('contentPublished', { contentId: id, requestId: meta.requestId })
        .catch((error: unknown) =>
          this.logger.error({ err: error }, 'Could not enqueue publish notification'),
        );
    }
    return this.get(principal, id);
  }

  submit(principal: Principal, id: string, meta: RequestMeta) {
    return this.transition(principal, id, 'submit', meta);
  }

  publish(
    principal: Principal,
    id: string,
    publishAt: string | null | undefined,
    meta: RequestMeta,
  ) {
    return this.transition(principal, id, 'publish', meta, publishAt);
  }

  unpublish(principal: Principal, id: string, meta: RequestMeta) {
    return this.transition(principal, id, 'unpublish', meta);
  }

  archive(principal: Principal, id: string, meta: RequestMeta) {
    return this.transition(principal, id, 'archive', meta);
  }

  /** Soft delete. Drafts can also be deleted by their author (while they can edit them). */
  async remove(principal: Principal, id: string, meta: RequestMeta): Promise<void> {
    const current = await this.load(principal, id);
    const rights = this.rights(principal, current);
    const ownDraft =
      rights.edit && current.status === 'DRAFT' && current.createdById === principal.userId;
    if (!rights.archive && !ownDraft) throw Errors.forbidden('You cannot delete this item.');
    await this.db.contentItem.update({
      where: { id },
      data: { deletedAt: new Date(), isPinned: false },
    });
    await this.audit.record({
      organizationId: await this.organizations.currentId(),
      actorId: principal.userId,
      action: 'content.delete',
      entityType: 'ContentItem',
      entityId: id,
      branchId: current.branchId,
      summary: current.title,
      meta,
    });
    if (current.status === 'PUBLISHED') this.revalidate([current.slug], meta);
  }

  // ---------------------------------------------------------------------------------------
  // Speakers and series
  // ---------------------------------------------------------------------------------------

  async createSpeaker(
    principal: Principal,
    input: z.output<typeof SpeakerInput>,
    meta: RequestMeta,
  ) {
    const organizationId = await this.organizations.currentId();
    const slug = await uniqueSlug(input.name, async (candidate) =>
      Boolean(
        await this.db.speaker.findFirst({
          where: { organizationId, slug: candidate },
          select: { id: true },
        }),
      ),
    );
    const speaker = await this.db.speaker.create({
      data: { organizationId, slug, name: input.name, title: input.title ?? null },
      select: { id: true, slug: true, name: true },
    });
    await this.audit.record({
      organizationId,
      actorId: principal.userId,
      action: 'speaker.create',
      entityType: 'Speaker',
      entityId: speaker.id,
      summary: speaker.name,
      meta,
    });
    return { slug: speaker.slug, name: speaker.name };
  }

  async createSeries(principal: Principal, input: z.output<typeof SeriesInput>, meta: RequestMeta) {
    const organizationId = await this.organizations.currentId();
    const slug = await uniqueSlug(input.title, async (candidate) =>
      Boolean(
        await this.db.sermonSeries.findFirst({
          where: { organizationId, slug: candidate },
          select: { id: true },
        }),
      ),
    );
    const series = await this.db.sermonSeries.create({
      data: { organizationId, slug, title: input.title, description: input.description ?? null },
      select: { id: true, slug: true, title: true },
    });
    await this.audit.record({
      organizationId,
      actorId: principal.userId,
      action: 'series.create',
      entityType: 'SermonSeries',
      entityId: series.id,
      summary: series.title,
      meta,
    });
    return { slug: series.slug, name: series.title };
  }

  /** Ask the web app to drop cached pages for these items (handled by the worker). */
  private revalidate(slugs: string[], meta: RequestMeta): void {
    const tags = [CacheTags.content, ...[...new Set(slugs)].map((s) => CacheTags.contentItem(s))];
    void this.jobs
      .enqueue('revalidateWeb', { tags, requestId: meta.requestId })
      .catch((error: unknown) =>
        this.logger.warn({ err: error }, 'Could not enqueue cache revalidation'),
      );
  }
}
