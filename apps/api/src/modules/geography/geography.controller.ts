import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BaptismSummary, BaptismSummaryQuery, GeographyOverview } from '@church/shared';
import type { FastifyReply } from 'fastify';
import type { z } from 'zod';
import { ApiResult, Public } from '../../common/decorators/index.js';
import { GeographyService } from './geography.service.js';

@ApiTags('geography')
@Public()
@Controller({ path: 'geography', version: '1' })
export class GeographyController {
  constructor(private readonly geography: GeographyService) {}

  @Get()
  @ApiOperation({ summary: 'Countries and branches with their member and baptism totals.' })
  @ApiResult(GeographyOverview)
  overview(@Res({ passthrough: true }) reply: FastifyReply) {
    void reply.header('cache-control', 'public, max-age=300, stale-while-revalidate=900');
    return this.geography.overview();
  }

  @Get('baptisms')
  @ApiOperation({ summary: 'Baptism totals for the whole church, by country and by year.' })
  @ApiResult(BaptismSummary)
  baptisms(
    @Query({ schema: BaptismSummaryQuery }) query: z.output<typeof BaptismSummaryQuery>,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    void reply.header('cache-control', 'public, max-age=300, stale-while-revalidate=900');
    return this.geography.baptismSummary(query.year);
  }
}
