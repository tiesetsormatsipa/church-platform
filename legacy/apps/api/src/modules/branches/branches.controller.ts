import { Controller, Get, Post, Patch, Param, Query, Body, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BranchesService } from './branches.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('branches')
@Controller({ path: 'branches', version: '1' })
export class BranchesController {
  constructor(private branchesService: BranchesService) {}

  @Public() @Get()
  findAll(@Req() req: any, @Query('search') search?: string, @Query('type') type?: string,
    @Query('countryId') countryId?: string, @Query('page') page = 1, @Query('limit') limit = 12) {
    return this.branchesService.findAll({ search, type, countryId, tenantId: req?.headers?.['x-tenant-id'], page: +page, limit: +limit });
  }

  @Public() @Get(':id')
  findOne(@Param('id') id: string) { return this.branchesService.findOne(id); }

  @ApiBearerAuth() @Post()
  @Roles('branch-admin', 'country-admin', 'regional-admin', 'super-admin')
  create(@Body() body: any, @Req() req: any) { return this.branchesService.create(body, req.user.id); }

  @ApiBearerAuth() @Patch(':id')
  @Roles('branch-admin', 'country-admin', 'super-admin')
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) { return this.branchesService.update(id, body, req.user.id); }

  @Public() @Get(':id/service-times')
  getServiceTimes(@Param('id') id: string, @Query('date') dateStr?: string) {
    return this.branchesService.getEffectiveServiceTimes(id, dateStr ? new Date(dateStr) : new Date());
  }

  @ApiBearerAuth() @Get(':id/records')
  @Roles('branch-admin', 'country-admin', 'super-admin', 'minister')
  getRecords(@Param('id') id: string, @Query('page') page = 1, @Query('limit') limit = 50,
    @Query('from') from?: string, @Query('to') to?: string) {
    return this.branchesService.getRecords(id, { page: +page, limit: +limit, from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined });
  }

  @ApiBearerAuth() @Post(':id/records')
  @Roles('branch-admin', 'minister', 'super-admin')
  createRecord(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.branchesService.createRecord(id, body, req.user.id);
  }

  @ApiBearerAuth() @Patch(':branchId/records/:recordId')
  @Roles('branch-admin', 'minister', 'super-admin')
  updateRecord(@Param('recordId') recordId: string, @Body() body: any, @Req() req: any) {
    return this.branchesService.updateRecord(recordId, body, req.user.id, body.reason);
  }
}
