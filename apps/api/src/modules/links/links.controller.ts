import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LegacyEntity, LegacyLink, SitemapResponse } from '@church/shared';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import { ApiResult, Public, RateLimit } from '../../common/decorators/index.js';
import { LinksService } from './links.service.js';

const LegacyId = z.string().trim().min(1).max(128);

@ApiTags('links')
@Public()
@Controller({ version: '1' })
export class LinksController {
  constructor(private readonly links: LinksService) {}

  @Get('legacy-links/:entity/:legacyId')
  @RateLimit({ name: 'legacy-links', limit: 120, windowSeconds: 60 })
  @ApiOperation({ summary: 'Current path of a record addressed by its legacy id (old URLs).' })
  @ApiResult(LegacyLink)
  async legacy(
    @Param('entity', { schema: LegacyEntity }) entity: LegacyEntity,
    @Param('legacyId', { schema: LegacyId }) legacyId: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const link = await this.links.resolveLegacy(entity, legacyId);
    void reply.header('cache-control', 'public, max-age=3600');
    return link;
  }

  @Get('sitemap')
  @ApiOperation({ summary: 'Public pages for the XML sitemap.' })
  @ApiResult(SitemapResponse)
  sitemap(@Res({ passthrough: true }) reply: FastifyReply) {
    void reply.header('cache-control', 'public, max-age=300, stale-while-revalidate=3600');
    return this.links.sitemap();
  }
}
