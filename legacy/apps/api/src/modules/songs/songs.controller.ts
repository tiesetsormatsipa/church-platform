// apps/api/src/modules/songs/songs.controller.ts
import {
  Controller, Get, Post, Param, Query, Body, Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SongsService } from './songs.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Feature } from '../../common/decorators/feature.decorator';

@ApiTags('songs')
@Feature('praise_songs')
@Controller({ path: 'songs', version: '1' })
export class SongsController {
  constructor(private songsService: SongsService) {}

  @Public()
  @Get()
  async findAll(
    @Req() req: any,
    @Query('search') search?: string,
    @Query('tab') tab?: string,
    @Query('language') language?: string,
    @Query('artist') artist?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.songsService.findAll({
      search, tab, language, artist,
      page: +page, limit: +limit,
      tenantId: req?.headers?.['x-tenant-id'],
    });
  }

  @Public()
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.songsService.findOne(id);
  }

  @ApiBearerAuth()
  @Post()
  @Roles('song-uploader', 'verified-member', 'super-admin')
  async create(@Body() body: any, @Req() req: any) {
    return this.songsService.create(
      { ...body, tenantId: req.headers['x-tenant-id'] },
      req.user.id,
    );
  }

  @ApiBearerAuth()
  @Post(':id/like')
  async like(@Param('id') id: string, @Req() req: any) {
    return this.songsService.toggleLike(id, req.user.id);
  }

  @ApiBearerAuth()
  @Get('admin/pending')
  @Roles('super-admin', 'platform-admin', 'branch-moderator')
  async getPending() {
    return this.songsService.getPendingApprovals();
  }

  @ApiBearerAuth()
  @Post('admin/:id/approve')
  @Roles('super-admin', 'platform-admin', 'branch-moderator')
  async approve(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: { notes?: string },
  ) {
    return this.songsService.approveSong(id, req.user.id, body.notes);
  }

  @ApiBearerAuth()
  @Post('admin/:id/reject')
  @Roles('super-admin', 'platform-admin', 'branch-moderator')
  async reject(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: { reason: string },
  ) {
    return this.songsService.rejectSong(id, req.user.id, body.reason);
  }
}
