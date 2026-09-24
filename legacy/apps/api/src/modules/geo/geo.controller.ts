import { Controller, Get, Post, Patch, Param, Query, Body, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { GeoService } from './geo.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('geo')
@Controller({ path: 'geo', version: '1' })
export class GeoController {
  constructor(private geoService: GeoService) {}

  @Public() @Get('overview')
  getOverview() { return this.geoService.getOverview(); }

  @Public() @Get('continents')
  getContinents() { return this.geoService.getContinents(); }

  @Public() @Get('regions')
  getRegions(@Query('continentId') continentId?: string) { return this.geoService.getRegions(continentId); }

  @Public() @Get('countries')
  getCountries(@Query('regionId') regionId?: string, @Query('continentId') continentId?: string) {
    return this.geoService.getCountries(regionId, continentId);
  }

  @Public() @Get('countries/:id')
  getCountry(@Param('id') id: string) { return this.geoService.getCountryById(id); }

  @Public() @Get('countries/:countryId/provinces')
  getProvinces(@Param('countryId') countryId: string) { return this.geoService.getProvinces(countryId); }

  @ApiBearerAuth() @Post('continents')
  @Roles('super-admin', 'platform-admin')
  createContinent(@Body() body: any, @Req() req: any) { return this.geoService.createContinent(body, req.user.id); }

  @ApiBearerAuth() @Post('regions')
  @Roles('super-admin', 'platform-admin', 'continental-admin')
  createRegion(@Body() body: any, @Req() req: any) { return this.geoService.createRegion(body, req.user.id); }

  @ApiBearerAuth() @Post('countries')
  @Roles('super-admin', 'platform-admin', 'continental-admin', 'regional-admin')
  createCountry(@Body() body: any, @Req() req: any) { return this.geoService.createCountry(body, req.user.id); }

  @ApiBearerAuth() @Patch('countries/:id/status')
  @Roles('super-admin', 'platform-admin')
  updateCountryStatus(@Param('id') id: string, @Body() body: { status: string; note?: string }, @Req() req: any) {
    return this.geoService.updateCountryStatus(id, body.status, req.user.id, body.note);
  }

  @ApiBearerAuth() @Get(':entityType/:entityId/status-history')
  @Roles('super-admin', 'platform-admin', 'regional-admin')
  getStatusHistory(@Param('entityType') entityType: string, @Param('entityId') entityId: string) {
    return this.geoService.getStatusHistory(entityType, entityId);
  }
}
