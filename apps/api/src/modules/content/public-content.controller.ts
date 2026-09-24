import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ContentDetail,
  ContentPage,
  ContentQuery,
  EventsQuery,
  HomeQuery,
  HomeResponse,
  SearchQuery,
  SearchResponse,
  SermonFacets,
  SermonsQuery,
  Slug,
} from '@church/shared';
import type { FastifyReply } from 'fastify';
import type { z } from 'zod';
import { ApiResult, Public, RateLimit } from '../../common/decorators/index.js';
import { ContentQueryService } from './content-query.service.js';

/** Short shared caching for anonymous reads; content changes appear within a minute. */
function cachePublic(reply: FastifyReply): void {
  void reply.header('cache-control', 'public, max-age=30, stale-while-revalidate=120');
}

@ApiTags('content')
@Public()
@Controller({ version: '1' })
export class PublicContentController {
  constructor(private readonly content: ContentQueryService) {}

  @Get('home')
  @ApiOperation({ summary: 'Everything the home page needs for a context, in one request.' })
  @ApiResult(HomeResponse)
  home(@Query({ schema: HomeQuery }) query: z.output<typeof HomeQuery>, @Res({ passthrough: true }) reply: FastifyReply) {
    cachePublic(reply);
    return this.content.home(query.branch);
  }

  @Get('content')
  @ApiOperation({ summary: 'Feed of published content, newest first (cursor pagination).' })
  @ApiResult(ContentPage)
  feed(@Query({ schema: ContentQuery }) query: z.output<typeof ContentQuery>, @Res({ passthrough: true }) reply: FastifyReply) {
    cachePublic(reply);
    return this.content.feed(query);
  }

  @Get('content/:slug')
  @ApiOperation({ summary: 'One published item of any type.' })
  @ApiResult(ContentDetail)
  detail(@Param('slug', { schema: Slug }) slug: string, @Res({ passthrough: true }) reply: FastifyReply) {
    cachePublic(reply);
    return this.content.detail(slug);
  }

  @Get('events')
  @ApiOperation({ summary: 'Upcoming (soonest first) or past (latest first) events.' })
  @ApiResult(ContentPage)
  events(@Query({ schema: EventsQuery }) query: z.output<typeof EventsQuery>, @Res({ passthrough: true }) reply: FastifyReply) {
    cachePublic(reply);
    return this.content.events(query);
  }

  @Get('sermons')
  @ApiOperation({ summary: 'Sermon library, newest first, with speaker/series/tag filters and search.' })
  @ApiResult(ContentPage)
  sermons(@Query({ schema: SermonsQuery }) query: z.output<typeof SermonsQuery>, @Res({ passthrough: true }) reply: FastifyReply) {
    cachePublic(reply);
    return this.content.sermons(query);
  }

  @Get('sermons/facets')
  @ApiOperation({ summary: 'Speakers, series and tags that have published sermons.' })
  @ApiResult(SermonFacets)
  facets(@Res({ passthrough: true }) reply: FastifyReply) {
    cachePublic(reply);
    return this.content.sermonFacets();
  }

  @Get('search')
  @RateLimit({ name: 'search', limit: 60, windowSeconds: 60 })
  @ApiOperation({ summary: 'Full-text search across published content and branches.' })
  @ApiResult(SearchResponse)
  search(@Query({ schema: SearchQuery }) query: z.output<typeof SearchQuery>) {
    return this.content.search(query);
  }
}
