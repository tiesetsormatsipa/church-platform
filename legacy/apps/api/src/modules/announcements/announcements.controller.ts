import { Controller, Get, Post, Patch, Delete, Param, Query, Body, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AnnouncementsService } from './announcements.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('announcements')
@Controller({ path: 'announcements', version: '1' })
export class AnnouncementsController {
  constructor(private announcementsService: AnnouncementsService) {}

  @Public()
  @Get()
  findAll(@Req() req: any, @Query('category') category?: string, @Query('branchId') branchId?: string,
    @Query('page') page = 1, @Query('limit') limit = 20) {
    return this.announcementsService.findAll({ category, branchId, page: +page, limit: +limit, tenantId: req?.headers?.['x-tenant-id'] });
  }

  @Public()
  @Get('home/countdown')
  getCountdown(@Req() req: any) {
    const tenantId = req?.headers?.['x-tenant-id'] || process.env.DEFAULT_TENANT_ID;
    return this.announcementsService.getCountdownConfig(tenantId);
  }

  @ApiBearerAuth()
  @Post()
  @Roles('super-admin', 'platform-admin', 'branch-admin', 'branch-moderator')
  create(@Body() body: any, @Req() req: any) {
    return this.announcementsService.create({ ...body, tenantId: req.headers['x-tenant-id'] }, req.user.id);
  }

  @ApiBearerAuth()
  @Patch(':id')
  @Roles('super-admin', 'platform-admin', 'branch-admin', 'branch-moderator')
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.announcementsService.update(id, body, req.user.id);
  }

  @ApiBearerAuth()
  @Post(':id/publish')
  @Roles('super-admin', 'platform-admin', 'branch-admin')
  publish(@Param('id') id: string, @Req() req: any) {
    return this.announcementsService.publish(id, req.user.id);
  }

  @ApiBearerAuth()
  @Delete(':id')
  @Roles('super-admin', 'platform-admin', 'branch-admin')
  delete(@Param('id') id: string, @Req() req: any) {
    return this.announcementsService.delete(id, req.user.id);
  }

  @ApiBearerAuth()
  @Patch('admin/countdown')
  @Roles('super-admin', 'platform-admin')
  updateCountdown(@Body() body: any, @Req() req: any) {
    return this.announcementsService.updateCountdownConfig(req.headers['x-tenant-id'], body, req.user.id);
  }
}
