import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  BaptismRecordDto,
  BaptismRecordList,
  BaptismRecordsQuery,
  CreateBaptismRecord,
  DeletedBaptismRecord,
  UpdateBaptismRecord,
  Uuid,
} from '@church/shared';
import type { z } from 'zod';
import {
  ApiResult,
  CurrentUser,
  Meta,
  RequirePermission,
  RequireVerifiedEmail,
} from '../../common/decorators/index.js';
import type { Principal, RequestMeta } from '../../common/principal.js';
import { AdminBaptismsService } from './admin-baptisms.service.js';

/** Recording how many people a branch baptised. The public totals live under /geography. */
@ApiTags('admin')
@RequireVerifiedEmail()
@RequirePermission('branch_record.read')
@Controller({ path: 'admin/baptism-records', version: '1' })
export class AdminBaptismsController {
  constructor(private readonly records: AdminBaptismsService) {}

  @Get()
  @ApiOperation({ summary: "A branch's baptism entries, newest first." })
  @ApiResult(BaptismRecordList)
  list(
    @CurrentUser() principal: Principal,
    @Query({ schema: BaptismRecordsQuery }) query: z.output<typeof BaptismRecordsQuery>,
  ) {
    return this.records.list(principal, query.branch);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: "Add to a branch's baptism number." })
  @ApiResult(BaptismRecordDto, { status: 201 })
  create(
    @CurrentUser() principal: Principal,
    @Body({ schema: CreateBaptismRecord }) body: z.output<typeof CreateBaptismRecord>,
    @Meta() meta: RequestMeta,
  ) {
    return this.records.create(principal, body, meta);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Correct a baptism entry.' })
  @ApiResult(BaptismRecordDto)
  update(
    @CurrentUser() principal: Principal,
    @Param('id', { schema: Uuid }) id: string,
    @Body({ schema: UpdateBaptismRecord }) body: z.output<typeof UpdateBaptismRecord>,
    @Meta() meta: RequestMeta,
  ) {
    return this.records.update(principal, id, body, meta);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a baptism entry that was recorded in error.' })
  @ApiResult(DeletedBaptismRecord)
  remove(
    @CurrentUser() principal: Principal,
    @Param('id', { schema: Uuid }) id: string,
    @Meta() meta: RequestMeta,
  ) {
    return this.records.remove(principal, id, meta);
  }
}
