/**
 * The jobs board.
 *
 * Members put openings forward for one another. A posting is an ordinary `ContentItem` of
 * type `JOB`, so it inherits the workflow the church already trusts: it is created
 * `PENDING_REVIEW`, a reviewer publishes it from the administration area, and until then
 * nobody but its author and the reviewers can see it. Editing a published posting sends it
 * straight back for review, because the promise is that nothing on the board has gone
 * unread — not that nothing arrived unread the first time.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { DatabaseClient, Prisma } from '@church/database';
import { JobProducer } from '@church/infrastructure/queue';
import {
  CacheTags,
  type CreateJobPosting,
  type JobDetailPage,
  type JobsPage,
  type JobsQuery,
  type JobSummary,
  type MyJobPosting,
  type MyJobPostings,
  slugify,
  type UpdateJobPosting,
  uniqueSlug,
} from '@church/shared';
import type { z } from 'zod';
import { Errors } from '../../common/http/errors.js';
import type { Principal, RequestMeta } from '../../common/principal.js';
import { DATABASE } from '../../infrastructure/tokens.js';
import { AuditService } from '../core/audit.service.js';
import { OrganizationService } from '../core/organization.service.js';

const JOB_SELECT = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  body: true,
  status: true,
  publishedAt: true,
  updatedAt: true,
  authorId: true,
  authorName: true,
  author: {
    select: { profile: { select: { firstName: true, lastName: true, displayName: true } } },
  },
  job: {
    select: {
      employerName: true,
      location: true,
      employmentType: true,
      salaryRange: true,
      applyEmail: true,
      applyUrl: true,
      applyNote: true,
      closesOn: true,
    },
  },
} satisfies Prisma.ContentItemSelect;

type JobRow = Prisma.ContentItemGetPayload<{ select: typeof JOB_SELECT }>;

/** Keyset cursor over (publishedAt desc, id desc), matching the content feed index. */
function encodeCursor(row: { publishedAt: Date | null; id: string }): string {
  return Buffer.from(`${row.publishedAt?.toISOString() ?? ''}|${row.id}`, 'utf8').toString(
    'base64url',
  );
}

function decodeCursor(cursor: string): { publishedAt: Date; id: string } {
  const [timestamp, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  const publishedAt = timestamp ? new Date(timestamp) : new Date(Number.NaN);
  if (!id || Number.isNaN(publishedAt.getTime()))
    throw Errors.badRequest('invalid_cursor', 'That page link is no longer valid.');
  return { publishedAt, id };
}

/** Midnight today, so a posting stays up for the whole of its closing day. */
function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly organizations: OrganizationService,
    private readonly audit: AuditService,
    private readonly queue: JobProducer,
  ) {}

  // -------------------------------------------------------------------------------------
  // The public board
  // -------------------------------------------------------------------------------------

  async list(query: z.output<typeof JobsQuery>): Promise<JobsPage> {
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    const rows = await this.db.contentItem.findMany({
      where: {
        type: 'JOB',
        status: 'PUBLISHED',
        deletedAt: null,
        publishedAt: { lte: new Date() },
        job: {
          ...(query.employmentType ? { employmentType: query.employmentType } : {}),
          ...(query.where ? { location: { contains: query.where, mode: 'insensitive' } } : {}),
          // A posting that has closed is history, not an opening.
          OR: [{ closesOn: null }, { closesOn: { gte: startOfToday() } }],
        },
        ...(query.q
          ? {
              OR: [
                { title: { contains: query.q, mode: 'insensitive' } },
                { summary: { contains: query.q, mode: 'insensitive' } },
                { job: { employerName: { contains: query.q, mode: 'insensitive' } } },
              ],
            }
          : {}),
        ...(cursor
          ? {
              OR: [
                { publishedAt: { lt: cursor.publishedAt } },
                { publishedAt: cursor.publishedAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      select: JOB_SELECT,
    });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const last = page.at(-1);
    return {
      items: page.map((row) => this.toSummary(row)),
      nextCursor: hasMore && last ? encodeCursor(last) : null,
    };
  }

  async bySlug(slug: string): Promise<JobDetailPage> {
    const row = await this.db.contentItem.findFirst({
      where: {
        type: 'JOB',
        slug,
        status: 'PUBLISHED',
        deletedAt: null,
        publishedAt: { lte: new Date() },
      },
      select: JOB_SELECT,
    });
    if (!row) throw Errors.notFound('That job');
    return { ...this.toSummary(row), body: row.body };
  }

  // -------------------------------------------------------------------------------------
  // A member's own postings
  // -------------------------------------------------------------------------------------

  async mine(principal: Principal): Promise<MyJobPostings> {
    const rows = await this.db.contentItem.findMany({
      where: { type: 'JOB', authorId: principal.userId, deletedAt: null },
      orderBy: [{ updatedAt: 'desc' }],
      take: 100,
      select: JOB_SELECT,
    });
    return { items: rows.map((row) => this.toMine(row)) };
  }

  async create(
    principal: Principal,
    input: z.output<typeof CreateJobPosting>,
    meta: RequestMeta,
  ): Promise<MyJobPosting> {
    const organizationId = await this.organizations.currentId();
    const slug = await this.slugFor(organizationId, input.title);

    const created = await this.db.contentItem.create({
      data: {
        organization: { connect: { id: organizationId } },
        type: 'JOB',
        scope: 'GLOBAL',
        slug,
        title: input.title,
        summary: input.summary ?? null,
        body: input.body ?? null,
        // Straight to review: a member has no draft state to sit in, and no way to publish.
        status: 'PENDING_REVIEW',
        author: { connect: { id: principal.userId } },
        createdBy: { connect: { id: principal.userId } },
        updatedBy: { connect: { id: principal.userId } },
        job: { create: this.detailData(input) },
      },
      select: JOB_SELECT,
    });

    await this.audit.record({
      organizationId,
      actorId: principal.userId,
      action: 'job.submit',
      entityType: 'ContentItem',
      entityId: created.id,
      summary: created.title,
      meta,
    });
    return this.toMine(created);
  }

  async update(
    principal: Principal,
    id: string,
    input: z.output<typeof UpdateJobPosting>,
    meta: RequestMeta,
  ): Promise<MyJobPosting> {
    const current = await this.loadMine(principal, id);
    if (current.status === 'ARCHIVED')
      throw Errors.conflict('JOB_ARCHIVED', 'This posting has been archived and cannot change.');

    const organizationId = await this.organizations.currentId();
    const wasPublished = current.status === 'PUBLISHED';

    const updated = await this.db.contentItem.update({
      where: { id },
      data: {
        title: input.title,
        summary: input.summary ?? null,
        body: input.body ?? null,
        // Any change goes back for review, including a change to a posting already on the
        // board: the promise is that nothing on the board has gone unread.
        status: 'PENDING_REVIEW',
        publishedAt: null,
        updatedBy: { connect: { id: principal.userId } },
        job: { upsert: { create: this.detailData(input), update: this.detailData(input) } },
      },
      select: JOB_SELECT,
    });

    await this.audit.record({
      organizationId,
      actorId: principal.userId,
      action: 'job.resubmit',
      entityType: 'ContentItem',
      entityId: id,
      summary: updated.title,
      meta,
    });
    // It has just left the board, so the board must be rebuilt.
    if (wasPublished) this.revalidate(current.slug, meta);
    return this.toMine(updated);
  }

  async withdraw(principal: Principal, id: string, meta: RequestMeta): Promise<void> {
    const current = await this.loadMine(principal, id);
    await this.db.contentItem.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: { connect: { id: principal.userId } } },
    });
    await this.audit.record({
      organizationId: await this.organizations.currentId(),
      actorId: principal.userId,
      action: 'job.withdraw',
      entityType: 'ContentItem',
      entityId: id,
      summary: current.title,
      meta,
    });
    if (current.status === 'PUBLISHED') this.revalidate(current.slug, meta);
  }

  // -------------------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------------------

  private detailData(input: z.output<typeof CreateJobPosting>) {
    return {
      employerName: input.employerName,
      location: input.location,
      employmentType: input.employmentType,
      salaryRange: input.salaryRange ?? null,
      applyEmail: input.applyEmail ?? null,
      applyUrl: input.applyUrl ?? null,
      applyNote: input.applyNote ?? null,
      closesOn: input.closesOn ? new Date(input.closesOn) : null,
    };
  }

  /** The caller's own posting. Somebody else's is a 404, not a 403. */
  private async loadMine(principal: Principal, id: string): Promise<JobRow> {
    const row = await this.db.contentItem.findFirst({
      where: { id, type: 'JOB', authorId: principal.userId, deletedAt: null },
      select: JOB_SELECT,
    });
    if (!row) throw Errors.notFound('That job posting');
    return row;
  }

  private async slugFor(organizationId: string, title: string): Promise<string> {
    return uniqueSlug(slugify(title, 'job'), async (candidate) => {
      const existing = await this.db.contentItem.findFirst({
        where: { organizationId, slug: candidate },
        select: { id: true },
      });
      return existing !== null;
    });
  }

  private revalidate(slug: string, meta: RequestMeta) {
    this.queue
      .enqueue('revalidateWeb', {
        tags: [CacheTags.content, CacheTags.contentItem(slug)],
        requestId: meta.requestId,
      })
      .catch((error: unknown) =>
        this.logger.error({ err: error }, 'Could not enqueue jobs revalidation'),
      );
  }

  private posterName(row: JobRow): string | null {
    const profile = row.author?.profile;
    const name =
      profile?.displayName?.trim() ||
      [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim();
    return name || row.authorName || null;
  }

  private toSummary(row: JobRow): JobSummary {
    const detail = row.job;
    if (!detail) throw new Error(`Job posting ${row.id} has no detail row`);
    const closesOn = detail.closesOn ? detail.closesOn.toISOString().slice(0, 10) : null;
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      postedBy: this.posterName(row),
      job: {
        employerName: detail.employerName,
        location: detail.location,
        employmentType: detail.employmentType,
        salaryRange: detail.salaryRange,
        applyEmail: detail.applyEmail,
        applyUrl: detail.applyUrl,
        applyNote: detail.applyNote,
        closesOn,
        closed: detail.closesOn !== null && detail.closesOn < startOfToday(),
      },
    };
  }

  private toMine(row: JobRow): MyJobPosting {
    return {
      ...this.toSummary(row),
      body: row.body,
      status: row.status,
      updatedAt: row.updatedAt.toISOString(),
      canEdit: row.status !== 'ARCHIVED',
    };
  }
}
