import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AcceptedResponse, BaptismRequestCreate } from '@church/shared';
import type { z } from 'zod';
import { ApiResult, Meta, OptionalUser, Public, RateLimit } from '../../common/decorators/index.js';
import type { Principal, RequestMeta } from '../../common/principal.js';
import { BaptismService } from './baptism.service.js';

@ApiTags('baptism')
@Controller({ path: 'baptism-requests', version: '1' })
export class BaptismController {
  constructor(private readonly baptism: BaptismService) {}

  @Public()
  @Post()
  @HttpCode(202)
  @RateLimit({ name: 'baptism.request', limit: 5, windowSeconds: 3600 })
  @ApiOperation({ summary: 'Ask to be baptised. The chosen branch is notified.' })
  @ApiResult(AcceptedResponse, { status: 202 })
  submit(
    @Body({ schema: BaptismRequestCreate }) body: z.output<typeof BaptismRequestCreate>,
    @OptionalUser() principal: Principal | null,
    @Meta() meta: RequestMeta,
  ) {
    return this.baptism.submit(body, principal, meta);
  }
}
