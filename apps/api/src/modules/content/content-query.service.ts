import { Inject, Injectable } from '@nestjs/common';
import type { ContentType, DatabaseClient, Prisma } from '@church/database';
import type {
  BranchRef,
  ContentDetail,
  ContentPage,
  ContentQuery,
  ContentSummary,
  EventsQuery,
  HomeResponse,
  ScopeFilter,
  SearchQuery,
  SearchResponse,
  SermonFacets,
  SermonsQuery,
} from '@church/shared';
import { Errors } from '../../common/http/errors.js';
import { DATABASE } from '../../infrastructure/tokens.js';
import { BranchQueryService } from '../branches/branch-query.service.js';
import { OrganizationService } from '../core/organization.service.js';
import { ContentMapper } from './content.mapper.js';
import { CONTENT_DETAIL_SELECT, CONTENT_SUMMARY_SELECT } from './content.select.js';
import { decodeCursor, encodeCursor, paginate } from './cursor.js';

/** Events without an end time stay "upcoming" for this long after they start. */
const OPEN_ENDED_EVENT_MS = 6 * 60 * 60 * 1000;

/**
 * Public read side of all content types. Every query goes through `visible()`, so drafts,
 * scheduled items, deleted items and content of deleted branches never leak.
 */
@Injectable()
export class ContentQueryService {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly organizations: OrganizationService,
    private readonly branches: BranchQueryService,
    private readonly mapper: ContentMapper,
  ) {}

  // ---------------------------------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------------------------------

  visible(organizationId: string, now: Date): Prisma.ContentItemWhereInput {
    return {
      organizationId,
      status: 'PUBLISHED',
      deletedAt: null,
      publishedAt: { lte: now },
      OR: [{ scope: 'GLOBAL' }, { branch: { deletedAt: null } }],
    };
  }

  /**
   * Branch context. Without a branch: everything. With a branch: that branch plus
   * church-wide content. `scope` narrows to church-wide only or branch content only.
   */
  context(branchId: string | null, scope: ScopeFilter): Prisma.ContentItemWhereInput {
    if (scope === 'global') return { scope: 'GLOBAL' };
    if (branchId) {
      return scope === 'branch' ? { branchId } : { OR: [{ scope: 'GLOBAL' }, { branchId }] };
    }
    return scope === 'branch' ? { scope: 'BRANCH' } : {};
  }

  private async base(branchSlug: string | undefined, scope: ScopeFilter, now = new Date()) {
    const organizationId = await this.organizations.currentId();
    const branch = branchSlug ? await this.branches.resolveRef(organizationId, branchSlug) : null;
    return {
      organizationId,
      branch,
      where: [this.visible(organizationId, now), this.context(branch?.id ?? null, scope)] as Prisma.ContentItemWhereInput[],
    };
  }

  // ---------------------------------------------------------------------------------------
  // Feed and detail
  // ---------------------------------------------------------------------------------------

  async feed(query: ContentQuery): Promise<ContentPage> {
    const { where } = await this.base(query.branch, query.scope);
    if (query.types?.length) where.push({ type: { in: query.types } });
    if (query.tag) where.push({ tags: { some: { tag: { slug: query.tag } } } });
    const cursor = decodeCursor(query.cursor);
    if (cursor) {
      const at = new Date(cursor.key);
      where.push({ OR: [{ publishedAt: { lt: at } }, { publishedAt: at, id: { lt: cursor.id } }] });
    }
    const rows = await this.db.contentItem.findMany({
      where: { AND: where },
      select: CONTENT_SUMMARY_SELECT,
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const page = paginate(rows, query.limit, (last) => encodeCursor(last.publishedAt!, last.id));
    return { items: page.items.map((r) => this.mapper.summary(r)), nextCursor: page.nextCursor };
  }

  async detail(slug: string): Promise<ContentDetail> {
    const organizationId = await this.organizations.currentId();
    const row = await this.db.contentItem.findFirst({
      where: { AND: [this.visible(organizationId, new Date()), { slug }] },
      select: CONTENT_DETAIL_SELECT,
    });
    if (!row) throw Errors.notFound('That page');
    const related = await this.db.contentItem.findMany({
      where: {
        AND: [
          this.visible(organizationId, new Date()),
          { type: row.type, id: { not: row.id } },
          row.branchId ? { OR: [{ branchId: row.branchId }, { scope: 'GLOBAL' }] } : {},
        ],
      },
      select: CONTENT_SUMMARY_SELECT,
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: 3,
    });
    return this.mapper.detail(
      row,
      related.map((r) => this.mapper.summary(r)),
    );
  }

  // ---------------------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------------------

  private eventTiming(when: 'upcoming' | 'past', now: Date): Prisma.ContentItemWhereInput {
    const openEndedCutoff = new Date(now.getTime() - OPEN_ENDED_EVENT_MS);
    return when === 'upcoming'
      ? {
          event: {
            OR: [{ endsAt: { gte: now } }, { endsAt: null, startsAt: { gte: openEndedCutoff } }],
          },
        }
      : {
          event: {
            OR: [{ endsAt: { lt: now } }, { endsAt: null, startsAt: { lt: openEndedCutoff } }],
          },
        };
  }

  async events(query: EventsQuery): Promise<ContentPage> {
    const now = new Date();
    const { where } = await this.base(query.branch, query.scope, now);
    where.push({ type: 'EVENT' }, this.eventTiming(query.when, now));
    if (query.category) where.push({ event: { category: query.category } });
    const ascending = query.when === 'upcoming';
    const cursor = decodeCursor(query.cursor);
    if (cursor) {
      const at = new Date(cursor.key);
      where.push(
        ascending
          ? { OR: [{ event: { startsAt: { gt: at } } }, { event: { startsAt: at }, id: { gt: cursor.id } }] }
          : { OR: [{ event: { startsAt: { lt: at } } }, { event: { startsAt: at }, id: { lt: cursor.id } }] },
      );
    }
    const direction = ascending ? 'asc' : 'desc';
    const rows = await this.db.contentItem.findMany({
      where: { AND: where },
      select: CONTENT_SUMMARY_SELECT,
      orderBy: [{ event: { startsAt: direction } }, { id: direction }],
      take: query.limit + 1,
    });
    const page = paginate(rows, query.limit, (last) => encodeCursor(last.event!.startsAt, last.id));
    return { items: page.items.map((r) => this.mapper.summary(r)), nextCursor: page.nextCursor };
  }

  // ---------------------------------------------------------------------------------------
  // Sermons
  // ---------------------------------------------------------------------------------------

  async sermons(query: SermonsQuery): Promise<ContentPage> {
    const { where, organizationId } = await this.base(query.branch, query.scope);
    where.push({ type: 'SERMON' });
    if (query.speaker) where.push({ sermon: { speaker: { slug: query.speaker } } });
    if (query.series) where.push({ sermon: { series: { slug: query.series } } });
    if (query.tag) where.push({ tags: { some: { tag: { slug: query.tag } } } });
    if (query.q) {
      const ids = await this.searchIds(organizationId, query.q, ['SERMON'], 500);
      where.push({ id: { in: ids.map((r) => r.id) } });
    }
    const cursor = decodeCursor(query.cursor);
    if (cursor) {
      const at = new Date(`${cursor.key}T00:00:00.000Z`);
      where.push({
        OR: [{ sermon: { preachedOn: { lt: at } } }, { sermon: { preachedOn: at }, id: { lt: cursor.id } }],
      });
    }
    const rows = await this.db.contentItem.findMany({
      where: { AND: where },
      select: CONTENT_SUMMARY_SELECT,
      orderBy: [{ sermon: { preachedOn: 'desc' } }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const page = paginate(rows, query.limit, (last) =>
      encodeCursor(last.sermon!.preachedOn.toISOString().slice(0, 10), last.id),
    );
    return { items: page.items.map((r) => this.mapper.summary(r)), nextCursor: page.nextCursor };
  }

  async sermonFacets(): Promise<SermonFacets> {
    const organizationId = await this.organizations.currentId();
    const visibleSermon = { AND: [this.visible(organizationId, new Date()), { type: 'SERMON' as const }] };
    const [speakers, series, tags] = await Promise.all([
      this.db.speaker.findMany({
        where: { organizationId, sermons: { some: { content: visibleSermon } } },
        select: {
          slug: true,
          name: true,
          title: true,
          _count: { select: { sermons: { where: { content: visibleSermon } } } },
        },
        orderBy: { name: 'asc' },
      }),
      this.db.sermonSeries.findMany({
        where: { organizationId, sermons: { some: { content: visibleSermon } } },
        select: {
          slug: true,
          title: true,
          description: true,
          _count: { select: { sermons: { where: { content: visibleSermon } } } },
        },
        orderBy: { title: 'asc' },
      }),
      this.db.tag.findMany({
        where: { organizationId, contents: { some: { content: visibleSermon } } },
        select: { slug: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return {
      speakers: speakers.map((s) => ({ slug: s.slug, name: s.name, title: s.title, sermonCount: s._count.sermons })),
      series: series.map((s) => ({
        slug: s.slug,
        title: s.title,
        description: s.description,
        sermonCount: s._count.sermons,
      })),
      tags,
    };
  }

  // ---------------------------------------------------------------------------------------
  // Home
  // ---------------------------------------------------------------------------------------

  async home(branchSlug: string | undefined): Promise<HomeResponse> {
    const now = new Date();
    const { where, organizationId, branch } = await this.base(branchSlug, 'all', now);
    const summaries = (rows: Parameters<ContentMapper['summary']>[0][]) => rows.map((r) => this.mapper.summary(r));

    const upcoming = this.eventTiming('upcoming', now);
    const [featured, pinned, events, latest, sermon, news, branchSummary] = await Promise.all([
      this.db.contentItem.findFirst({
        where: { AND: [...where, { type: 'EVENT', isFeatured: true }, upcoming] },
        select: CONTENT_SUMMARY_SELECT,
        orderBy: { event: { startsAt: 'asc' } },
      }),
      this.db.contentItem.findMany({
        where: {
          AND: [...where, { isPinned: true, OR: [{ pinnedUntil: null }, { pinnedUntil: { gt: now } }] }],
        },
        select: CONTENT_SUMMARY_SELECT,
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        take: 3,
      }),
      this.db.contentItem.findMany({
        where: { AND: [...where, { type: 'EVENT' }, upcoming] },
        select: CONTENT_SUMMARY_SELECT,
        orderBy: [{ event: { startsAt: 'asc' } }, { id: 'asc' }],
        take: 5,
      }),
      this.db.contentItem.findMany({
        where: { AND: [...where, { type: { in: ['POST', 'ANNOUNCEMENT', 'BAPTISM'] satisfies ContentType[] } }] },
        select: CONTENT_SUMMARY_SELECT,
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        take: 8,
      }),
      this.db.contentItem.findFirst({
        where: { AND: [...where, { type: 'SERMON' }] },
        select: CONTENT_SUMMARY_SELECT,
        orderBy: [{ sermon: { preachedOn: 'desc' } }, { id: 'desc' }],
      }),
      this.db.contentItem.findMany({
        where: { AND: [...where, { type: 'NEWS' }] },
        select: CONTENT_SUMMARY_SELECT,
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        take: 3,
      }),
      branch ? this.branches.summaryById(organizationId, branch.id) : Promise.resolve(null),
    ]);

    const pinnedIds = new Set(pinned.map((p) => p.id));
    return {
      branch: branchSummary,
      featuredEvent: featured ? this.mapper.summary(featured) : null,
      pinned: summaries(pinned),
      upcomingEvents: summaries(events.filter((e) => e.id !== featured?.id).slice(0, 4)),
      latest: summaries(latest.filter((l) => !pinnedIds.has(l.id)).slice(0, 6)),
      latestSermon: sermon ? this.mapper.summary(sermon) : null,
      news: summaries(news),
    };
  }

  // ---------------------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------------------

  /**
   * Prefix-aware full-text query over the generated search vector. Words are reduced to
   * letters and digits before building the tsquery, so user input cannot inject syntax.
   */
  private async searchIds(organizationId: string, text: string, types: ContentType[] | null, limit: number) {
    const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.slice(0, 8) ?? [];
    if (words.length === 0) return [];
    const tsquery = words.map((w) => `${w}:*`).join(' & ');
    const typeFilter = types?.length ? types : null;
    return this.db.$queryRaw<{ id: string; rank: number }[]>`
      SELECT c.id, ts_rank_cd(c.search_vector, q) AS rank
      FROM content_items c, to_tsquery('english', ${tsquery}) q
      WHERE c.organization_id = ${organizationId}::uuid
        AND c.status = 'PUBLISHED'
        AND c.deleted_at IS NULL
        AND c.published_at <= now()
        AND c.search_vector @@ q
        AND (${typeFilter}::text[] IS NULL OR c.type::text = ANY(${typeFilter}::text[]))
      ORDER BY rank DESC, c.published_at DESC
      LIMIT ${limit}`;
  }

  async search(query: SearchQuery): Promise<SearchResponse> {
    const organizationId = await this.organizations.currentId();
    const branch = query.branch ? await this.branches.resolveRef(organizationId, query.branch) : null;
    const ranked = await this.searchIds(organizationId, query.q, query.types ?? null, query.limit * 2);
    const order = new Map(ranked.map((r, i) => [r.id, i]));
    const rows = ranked.length
      ? await this.db.contentItem.findMany({
          where: {
            AND: [
              this.visible(organizationId, new Date()),
              this.context(branch?.id ?? null, 'all'),
              { id: { in: ranked.map((r) => r.id) } },
            ],
          },
          select: CONTENT_SUMMARY_SELECT,
        })
      : [];
    rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    const branches: BranchRef[] = await this.branches.search(organizationId, query.q, 5);
    return {
      query: query.q,
      content: rows.slice(0, query.limit).map((r) => this.mapper.summary(r)),
      branches,
    };
  }

  /** Summaries for arbitrary ids, preserving order (used by notifications and admin). */
  async summariesByIds(ids: string[]): Promise<ContentSummary[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.contentItem.findMany({ where: { id: { in: ids } }, select: CONTENT_SUMMARY_SELECT });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [this.mapper.summary(row)] : [];
    });
  }
}
