import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AdminContentDetail,
  AdminContentList,
  AdminContentQuery,
  ContentEditorOptions,
  ContentInput,
  OkResponse,
  PublishRequest,
  SeriesInput,
  SlugRef,
  SpeakerInput,
  Uuid,
} from '@church/shared';
import type { z } from 'zod';
import {
  ApiResult,
  CurrentUser,
  Meta,
  RateLimit,
  RequirePermission,
  RequireVerifiedEmail,
} from '../../common/decorators/index.js';
import type { Principal, RequestMeta } from '../../common/principal.js';
import { AdminContentService } from './admin-content.service.js';

const WRITE_LIMIT = {
  name: 'admin.content.write',
  limit: 300,
  windowSeconds: 3600,
  by: 'user',
} as const;

@ApiTags('admin: content')
@RequireVerifiedEmail()
@RequirePermission('content.create')
@Controller({ path: 'admin/content', version: '1' })
export class AdminContentController {
  constructor(private readonly content: AdminContentService) {}

  @Get()
  @ApiOperation({ summary: 'Content you can manage, most recently changed first (all statuses).' })
  @ApiResult(AdminContentList)
  list(
    @CurrentUser() principal: Principal,
    @Query({ schema: AdminContentQuery }) query: z.output<typeof AdminContentQuery>,
  ) {
    return this.content.list(principal, query);
  }

  @Get('options')
  @ApiOperation({ summary: 'Branches, speakers, series and tags for the editor.' })
  @ApiResult(ContentEditorOptions)
  options(@CurrentUser() principal: Principal) {
    return this.content.options(principal);
  }

  @Get(':id')
  @ApiResult(AdminContentDetail)
  get(@CurrentUser() principal: Principal, @Param('id', { schema: Uuid }) id: string) {
    return this.content.get(principal, id);
  }

  @Post()
  @HttpCode(201)
  @RateLimit(WRITE_LIMIT)
  @ApiOperation({ summary: 'Create a draft.' })
  @ApiResult(AdminContentDetail, { status: 201 })
  create(
    @CurrentUser() principal: Principal,
    @Body({ schema: ContentInput }) body: z.output<typeof ContentInput>,
    @Meta() meta: RequestMeta,
  ) {
    return this.content.create(principal, body, meta);
  }

  @Put(':id')
  @RateLimit(WRITE_LIMIT)
  @ApiOperation({ summary: 'Save the editor form (status changes use the actions below).' })
  @ApiResult(AdminContentDetail)
  update(
    @CurrentUser() principal: Principal,
    @Param('id', { schema: Uuid }) id: string,
    @Body({ schema: ContentInput }) body: z.output<typeof ContentInput>,
    @Meta() meta: RequestMeta,
  ) {
    return this.content.update(principal, id, body, meta);
  }

  @Post(':id/submit')
  @HttpCode(200)
  @ApiOperation({ summary: 'Submit a draft for review.' })
  @ApiResult(AdminContentDetail)
  submit(
    @CurrentUser() principal: Principal,
    @Param('id', { schema: Uuid }) id: string,
    @Meta() meta: RequestMeta,
  ) {
    return this.content.submit(principal, id, meta);
  }

  @Post(':id/publish')
  @HttpCode(200)
  @ApiOperation({ summary: 'Publish now or schedule for later.' })
  @ApiResult(AdminContentDetail)
  publish(
    @CurrentUser() principal: Principal,
    @Param('id', { schema: Uuid }) id: string,
    @Body({ schema: PublishRequest }) body: z.output<typeof PublishRequest>,
    @Meta() meta: RequestMeta,
  ) {
    return this.content.publish(principal, id, body.publishAt, meta);
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  @ApiOperation({ summary: 'Take published content back to draft.' })
  @ApiResult(AdminContentDetail)
  unpublish(
    @CurrentUser() principal: Principal,
    @Param('id', { schema: Uuid }) id: string,
    @Meta() meta: RequestMeta,
  ) {
    return this.content.unpublish(principal, id, meta);
  }

  @Post(':id/archive')
  @HttpCode(200)
  @ApiResult(AdminContentDetail)
  archive(
    @CurrentUser() principal: Principal,
    @Param('id', { schema: Uuid }) id: string,
    @Meta() meta: RequestMeta,
  ) {
    return this.content.archive(principal, id, meta);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete (soft). Authors may delete their own drafts.' })
  @ApiResult(OkResponse)
  async remove(
    @CurrentUser() principal: Principal,
    @Param('id', { schema: Uuid }) id: string,
    @Meta() meta: RequestMeta,
  ) {
    await this.content.remove(principal, id, meta);
    return { ok: true as const };
  }
}

@ApiTags('admin: content')
@RequireVerifiedEmail()
@RequirePermission('content.create')
@Controller({ path: 'admin', version: '1' })
export class AdminSpeakersController {
  constructor(private readonly content: AdminContentService) {}

  @Post('speakers')
  @HttpCode(201)
  @RateLimit(WRITE_LIMIT)
  @ApiResult(SlugRef, { status: 201 })
  createSpeaker(
    @CurrentUser() principal: Principal,
    @Body({ schema: SpeakerInput }) body: z.output<typeof SpeakerInput>,
    @Meta() meta: RequestMeta,
  ) {
    return this.content.createSpeaker(principal, body, meta);
  }

  @Post('series')
  @HttpCode(201)
  @RateLimit(WRITE_LIMIT)
  @ApiResult(SlugRef, { status: 201 })
  createSeries(
    @CurrentUser() principal: Principal,
    @Body({ schema: SeriesInput }) body: z.output<typeof SeriesInput>,
    @Meta() meta: RequestMeta,
  ) {
    return this.content.createSeries(principal, body, meta);
  }
}
