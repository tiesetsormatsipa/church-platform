import { Controller, Get, Post, Patch, Param, Query, Body, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MarketplaceService } from './marketplace.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Feature } from '../../common/decorators/feature.decorator';

@ApiTags('marketplace')
@Feature('marketplace')
@Controller({ path: 'marketplace', version: '1' })
export class MarketplaceController {
  constructor(private marketplaceService: MarketplaceService) {}

  @Public() @Get('categories')
  getCategories() { return this.marketplaceService.getCategories(); }

  @Public() @Get('products')
  findProducts(@Req() req: any, @Query('search') search?: string, @Query('categoryId') categoryId?: string,
    @Query('storeId') storeId?: string, @Query('page') page = 1, @Query('limit') limit = 16) {
    return this.marketplaceService.findProducts({ search, categoryId, storeId, page: +page, limit: +limit, tenantId: req?.headers?.['x-tenant-id'] });
  }

  @Public() @Get('products/:id')
  findProduct(@Param('id') id: string) { return this.marketplaceService.findProductById(id); }

  @ApiBearerAuth() @Get('my-store')
  @Roles('marketplace-seller', 'super-admin')
  getMyStore(@Req() req: any) { return this.marketplaceService.getMyStore(req.user.id); }

  @ApiBearerAuth() @Post('stores')
  @Roles('verified-member', 'super-admin')
  createStore(@Body() body: any, @Req() req: any) {
    return this.marketplaceService.createStore({ ...body, tenantId: req.headers['x-tenant-id'] }, req.user.id);
  }

  @ApiBearerAuth() @Post('products')
  @Roles('marketplace-seller', 'super-admin')
  createProduct(@Body() body: any, @Req() req: any) { return this.marketplaceService.createProduct(body, req.user.id); }

  @ApiBearerAuth() @Get('admin/pending-products')
  @Roles('super-admin', 'platform-admin', 'branch-moderator')
  getPendingProducts() { return this.marketplaceService.getPendingProducts(); }

  @ApiBearerAuth() @Post('admin/products/:id/approve')
  @Roles('super-admin', 'platform-admin', 'branch-moderator')
  approveProduct(@Param('id') id: string, @Req() req: any, @Body() body: { notes?: string }) {
    return this.marketplaceService.approveProduct(id, req.user.id, body.notes);
  }
}
