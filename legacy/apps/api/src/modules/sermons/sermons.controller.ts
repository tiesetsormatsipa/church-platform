import { Controller, Get, Post, Patch, Param, Query, Body, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SermonsService } from './sermons.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Feature } from '../../common/decorators/feature.decorator';

@ApiTags('sermons')
@Feature('sermons')
@Controller({ path: 'sermons', version: '1' })
export class SermonsController {
  constructor(private sermonsService: SermonsService) {}

  @Public() @Get()
  findAll(@Req() req: any, @Query('search') search?: string, @Query('tab') tab?: string,
    @Query('minister') minister?: string, @Query('branchId') branchId?: string,
    @Query('countryId') countryId?: string, @Query('language') language?: string,
    @Query('page') page = 1, @Query('limit') limit = 20) {
    return this.sermonsService.findAll({ search, tab, minister, branchId, countryId, language, page: +page, limit: +limit, tenantId: req?.headers?.['x-tenant-id'] });
  }

  @Public() @Get(':id')
  findOne(@Param('id') id: string) { return this.sermonsService.findOne(id); }

  @ApiBearerAuth() @Post()
  @Roles('minister', 'overseer', 'super-admin', 'platform-admin')
  create(@Body() body: any, @Req() req: any) {
    return this.sermonsService.create({ ...body, tenantId: req.headers['x-tenant-id'] }, req.user.id);
  }

  @ApiBearerAuth() @Patch(':id/publish')
  @Roles('super-admin', 'platform-admin', 'branch-moderator')
  publish(@Param('id') id: string, @Req() req: any) { return this.sermonsService.publish(id, req.user.id); }
}
