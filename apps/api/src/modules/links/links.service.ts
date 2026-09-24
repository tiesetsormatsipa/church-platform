import { Inject, Injectable } from '@nestjs/common';
import type { DatabaseClient } from '@church/database';
import { contentPath, LEGACY_ENTITY_TYPE, type LegacyEntity, type LegacyLink, type SitemapResponse } from '@church/shared';
import { Errors } from '../../common/http/errors.js';
import { DATABASE } from '../../infrastructure/tokens.js';
import { ContentQueryService } from '../content/content-query.service.js';
import { OrganizationService } from '../core/organization.service.js';

/** Sitemaps list at most this many content items (the newest). */
const SITEMAP_CONTENT_LIMIT = 5000;

@Injectable()
export class LinksService {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly organizations: OrganizationService,
    private readonly content: ContentQueryService,
  ) {}

  /**
   * The current URL of something imported from the legacy system, so old links keep working.
   * Only public records resolve; everything else is a 404 like any unknown page.
   */
  async resolveLegacy(entity: LegacyEntity, legacyId: string): Promise<LegacyLink> {
    const organizationId = await this.organizations.currentId();
    const mapped = await this.db.legacyIdMap.findFirst({
      where: { entityType: LEGACY_ENTITY_TYPE[entity], legacyId },
      orderBy: { importedAt: 'desc' },
      select: { newId: true },
    });
    if (mapped) {
      if (entity === 'branch') {
        const branch = await this.db.branch.findFirst({
          where: { id: mapped.newId, organizationId, deletedAt: null, status: 'ACTIVE' },
          select: { slug: true },
        });
        if (branch) return { path: `/branches/${branch.slug}` };
      } else {
        const item = await this.db.contentItem.findFirst({
          where: { ...this.content.visible(organizationId, new Date()), id: mapped.newId },
          select: { type: true, slug: true },
        });
        if (item) return { path: contentPath(item.type, item.slug) };
      }
    }
    throw Errors.notFound('That page');
  }

  async sitemap(): Promise<SitemapResponse> {
    const organizationId = await this.organizations.currentId();
    const [content, branches] = await Promise.all([
      this.db.contentItem.findMany({
        where: this.content.visible(organizationId, new Date()),
        select: { type: true, slug: true, updatedAt: true },
        orderBy: { publishedAt: 'desc' },
        take: SITEMAP_CONTENT_LIMIT,
      }),
      this.db.branch.findMany({
        where: { organizationId, deletedAt: null, status: 'ACTIVE' },
        select: { slug: true, updatedAt: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return {
      content: content.map((c) => ({ path: contentPath(c.type, c.slug), updatedAt: c.updatedAt.toISOString() })),
      branches: branches.map((b) => ({ path: `/branches/${b.slug}`, updatedAt: b.updatedAt.toISOString() })),
    };
  }
}
