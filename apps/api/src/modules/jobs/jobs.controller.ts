import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateJobPosting,
  JobDetailPage,
  JobsPage,
  JobsQuery,
  MyJobPosting,
  MyJobPostings,
  Slug,
  UpdateJobPosting,
  Uuid,
} from '@church/shared';
import type { z } from 'zod';
import {
  ApiResult,
  CurrentUser,
  Meta,
  Public,
  RateLimit,
  RequireVerifiedEmail,
} from '../../common/decorators/index.js';
import type { Principal, RequestMeta } from '../../common/principal.js';
import { JobsService } from './jobs.service.js';

/** The board itself: published postings, open to anyone. */
@ApiTags('jobs')
@Controller({ path: 'jobs', version: '1' })
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Open positions members have posted, newest first.' })
  @ApiResult(JobsPage)
  list(@Query({ schema: JobsQuery }) query: z.output<typeof JobsQuery>) {
    return this.jobs.list(query);
  }

  @Get(':slug')
  @Public()
  @ApiOperation({ summary: 'One published posting.' })
  @ApiResult(JobDetailPage)
  bySlug(@Param('slug', { schema: Slug }) slug: string) {
    return this.jobs.bySlug(slug);
  }
}

/**
 * A member's own postings.
 *
 * Posting is not an administrative act — any member with a confirmed address may put an
 * opening forward — but nothing they write reaches the board until a reviewer publishes it
 * from the administration area.
 */
@ApiTags('jobs')
@RequireVerifiedEmail()
@Controller({ path: 'me/jobs', version: '1' })
export class MyJobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  @ApiOperation({ summary: 'Postings you have put forward, in whatever state they are in.' })
  @ApiResult(MyJobPostings)
  mine(@CurrentUser() principal: Principal) {
    return this.jobs.mine(principal);
  }

  @Post()
  @HttpCode(201)
  @RateLimit({ name: 'jobs.create', limit: 10, windowSeconds: 86_400, by: 'user' })
  @ApiOperation({ summary: 'Put an opening forward; a reviewer reads it before anyone else.' })
  @ApiResult(MyJobPosting, { status: 201 })
  create(
    @CurrentUser() principal: Principal,
    @Body({ schema: CreateJobPosting }) body: z.output<typeof CreateJobPosting>,
    @Meta() meta: RequestMeta,
  ) {
    return this.jobs.create(principal, body, meta);
  }

  @Patch(':id')
  @RateLimit({ name: 'jobs.update', limit: 40, windowSeconds: 86_400, by: 'user' })
  @ApiOperation({ summary: 'Change a posting. It goes back for review, published or not.' })
  @ApiResult(MyJobPosting)
  update(
    @Param('id', { schema: Uuid }) id: string,
    @CurrentUser() principal: Principal,
    @Body({ schema: UpdateJobPosting }) body: z.output<typeof UpdateJobPosting>,
    @Meta() meta: RequestMeta,
  ) {
    return this.jobs.update(principal, id, body, meta);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Withdraw a posting of your own.' })
  async withdraw(
    @Param('id', { schema: Uuid }) id: string,
    @CurrentUser() principal: Principal,
    @Meta() meta: RequestMeta,
  ) {
    await this.jobs.withdraw(principal, id, meta);
  }
}
