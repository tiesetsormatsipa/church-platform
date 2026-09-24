import { Inject, Injectable } from '@nestjs/common';
import type { DatabaseClient, Prisma } from '@church/database';
import type { BranchDetail, BranchRef, BranchSummary } from '@church/shared';
import { Errors } from '../../common/http/errors.js';
import { DATABASE } from '../../infrastructure/tokens.js';
import { MEDIA_URL_SELECT, MediaUrlService } from '../core/media-urls.service.js';
import { OrganizationService } from '../core/organization.service.js';
import { effectiveSchedules, todayIn, toScheduleDto } from './schedules.js';

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
} as const satisfies Prisma.BranchScheduleSelect;

const SUMMARY_SELECT = {
  id: true,
  slug: true,
  name: true,
  type: true,
  city: true,
  province: true,
  countryCode: true,
  coverMedia: { select: MEDIA_URL_SELECT },
  schedules: { where: { isActive: true }, select: SCHEDULE_SELECT },
} as const satisfies Prisma.BranchSelect;

type SummaryRow = Prisma.BranchGetPayload<{ select: typeof SUMMARY_SELECT }>;

/** Public branch directory. Only active, non-deleted branches are listed. */
@Injectable()
export class BranchQueryService {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly organizations: OrganizationService,
    private readonly media: MediaUrlService,
  ) {}

  private publicWhere(organizationId: string): Prisma.BranchWhereInput {
    return { organizationId, deletedAt: null, status: 'ACTIVE' };
  }

  /** Resolve a branch slug from a URL; 404 for unknown or hidden branches. */
  async resolveRef(organizationId: string, slug: string): Promise<BranchRef> {
    const branch = await this.db.branch.findFirst({
      where: { ...this.publicWhere(organizationId), slug },
      select: { id: true, slug: true, name: true },
    });
    if (!branch) throw Errors.notFound('That branch');
    return branch;
  }

  private async today(): Promise<string> {
    const organization = await this.organizations.current();
    return todayIn(organization.timezone);
  }

  private toSummary(row: SummaryRow, today: string): BranchSummary {
    const { current, temporary } = effectiveSchedules(row.schedules, today);
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      type: row.type,
      city: row.city,
      province: row.province,
      countryCode: row.countryCode,
      cover: this.media.image(row.coverMedia),
      services: current.filter((s) => s.kind === 'SERVICE').map(toScheduleDto),
      hasTemporaryChanges: temporary.length > 0,
    };
  }

  async list(): Promise<BranchSummary[]> {
    const organizationId = await this.organizations.currentId();
    const [rows, today] = await Promise.all([
      this.db.branch.findMany({
        where: this.publicWhere(organizationId),
        select: SUMMARY_SELECT,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.today(),
    ]);
    return rows.map((row) => this.toSummary(row, today));
  }

  async summaryById(organizationId: string, id: string): Promise<BranchSummary | null> {
    const [row, today] = await Promise.all([
      this.db.branch.findFirst({ where: { ...this.publicWhere(organizationId), id }, select: SUMMARY_SELECT }),
      this.today(),
    ]);
    return row ? this.toSummary(row, today) : null;
  }

  async detail(slug: string): Promise<BranchDetail> {
    const organizationId = await this.organizations.currentId();
    const [row, today] = await Promise.all([
      this.db.branch.findFirst({
        where: { ...this.publicWhere(organizationId), slug },
        select: {
          ...SUMMARY_SELECT,
          description: true,
          addressLine1: true,
          addressLine2: true,
          postalCode: true,
          latitude: true,
          longitude: true,
          mapsUrl: true,
          phone: true,
          email: true,
          parentBranch: { select: { id: true, slug: true, name: true, deletedAt: true, status: true } },
          subBranches: {
            where: { deletedAt: null, status: 'ACTIVE' },
            select: { id: true, slug: true, name: true },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          },
          leaders: {
            where: { isActive: true },
            select: { id: true, name: true, title: true, bio: true, photoMedia: { select: MEDIA_URL_SELECT } },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          },
          galleryItems: {
            select: { caption: true, media: { select: MEDIA_URL_SELECT } },
            orderBy: { sortOrder: 'asc' },
            take: 24,
          },
        },
      }),
      this.today(),
    ]);
    if (!row) throw Errors.notFound('That branch');
    const summary = this.toSummary(row, today);
    const { current, temporary } = effectiveSchedules(row.schedules, today);
    const parent =
      row.parentBranch && !row.parentBranch.deletedAt && row.parentBranch.status === 'ACTIVE'
        ? { id: row.parentBranch.id, slug: row.parentBranch.slug, name: row.parentBranch.name }
        : null;
    return {
      ...summary,
      description: row.description,
      addressLine1: row.addressLine1,
      addressLine2: row.addressLine2,
      postalCode: row.postalCode,
      latitude: row.latitude === null ? null : Number(row.latitude),
      longitude: row.longitude === null ? null : Number(row.longitude),
      mapsUrl: row.mapsUrl,
      phone: row.phone,
      email: row.email,
      parent,
      subBranches: row.subBranches,
      schedules: current.map(toScheduleDto),
      temporaryChanges: temporary.map(toScheduleDto),
      leaders: row.leaders.map((l) => ({
        id: l.id,
        name: l.name,
        title: l.title,
        bio: l.bio,
        photo: this.media.image(l.photoMedia),
      })),
      gallery: row.galleryItems.flatMap((item) => {
        const image = this.media.image(item.media);
        return image ? [{ ...image, caption: item.caption }] : [];
      }),
    };
  }

  /** Fuzzy name search (trigram index). */
  async search(organizationId: string, text: string, limit: number): Promise<BranchRef[]> {
    const q = text.trim();
    if (q.length < 2) return [];
    return this.db.$queryRaw<BranchRef[]>`
      SELECT id, slug, name FROM branches
      WHERE organization_id = ${organizationId}::uuid AND deleted_at IS NULL AND status = 'ACTIVE'
        AND (name ILIKE ${`%${q.replace(/[%_\\]/g, '\\$&')}%`} OR similarity(name, ${q}) > 0.3)
      ORDER BY similarity(name, ${q}) DESC, name
      LIMIT ${limit}`;
  }
}
