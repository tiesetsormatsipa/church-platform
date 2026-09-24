import { Controller, Get, Post, Patch, Param, Query, Body, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Feature } from '../../common/decorators/feature.decorator';

@ApiTags('jobs')
@Feature('jobs')
@Controller({ path: 'jobs', version: '1' })
export class JobsController {
  constructor(private jobsService: JobsService) {}

  @Public()
  @Get()
  findAll(@Req() req: any, @Query('search') search?: string, @Query('type') type?: string,
    @Query('countryId') countryId?: string, @Query('category') category?: string,
    @Query('page') page = 1, @Query('limit') limit = 12) {
    return this.jobsService.findAll({ search, type, countryId, category, page: +page, limit: +limit, tenantId: req?.headers?.['x-tenant-id'] });
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) { return this.jobsService.findOne(id); }

  @ApiBearerAuth()
  @Post()
  @Roles('job-poster', 'marketplace-seller', 'verified-member', 'super-admin')
  create(@Body() body: any, @Req() req: any) { return this.jobsService.create(body, req.user.id); }

  @ApiBearerAuth()
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) { return this.jobsService.update(id, body, req.user.id); }

  @ApiBearerAuth()
  @Post(':id/apply')
  @Roles('verified-member', 'branch-admin', 'super-admin')
  apply(@Param('id') id: string, @Req() req: any, @Body() body: { coverLetter?: string }) {
    return this.jobsService.apply(id, req.user.id, body);
  }

  @ApiBearerAuth()
  @Get('admin/pending')
  @Roles('super-admin', 'platform-admin', 'branch-moderator')
  getPending() { return this.jobsService.getPendingApprovals(); }

  @ApiBearerAuth()
  @Post('admin/:id/approve')
  @Roles('super-admin', 'platform-admin', 'branch-moderator')
  approve(@Param('id') id: string, @Req() req: any, @Body() body: { notes?: string }) {
    return this.jobsService.approve(id, req.user.id, body.notes);
  }

  @ApiBearerAuth()
  @Post('admin/:id/reject')
  @Roles('super-admin', 'platform-admin', 'branch-moderator')
  reject(@Param('id') id: string, @Req() req: any, @Body() body: { reason: string }) {
    return this.jobsService.reject(id, req.user.id, body.reason);
  }
}
