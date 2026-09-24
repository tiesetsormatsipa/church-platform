import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BranchDetail, BranchList, Slug } from '@church/shared';
import type { FastifyReply } from 'fastify';
import { ApiResult, Public } from '../../common/decorators/index.js';
import { BranchQueryService } from './branch-query.service.js';

@ApiTags('branches')
@Public()
@Controller({ path: 'branches', version: '1' })
export class PublicBranchesController {
  constructor(private readonly branches: BranchQueryService) {}

  @Get()
  @ApiResult(BranchList)
  async list(@Res({ passthrough: true }) reply: FastifyReply) {
    void reply.header('cache-control', 'public, max-age=60, stale-while-revalidate=300');
    return { items: await this.branches.list() };
  }

  @Get(':slug')
  @ApiResult(BranchDetail)
  detail(
    @Param('slug', { schema: Slug }) slug: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    void reply.header('cache-control', 'public, max-age=60, stale-while-revalidate=300');
    return this.branches.detail(slug);
  }
}
