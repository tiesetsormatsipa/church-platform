import { Controller, Get, Post, Param, Body, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Feature } from '../../common/decorators/feature.decorator';

@ApiTags('marketplace')
@ApiBearerAuth()
@Feature('marketplace')
@Controller({ path: 'marketplace/orders', version: '1' })
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  createOrder(@Req() req: any, @Body() body: { items: any[] }) {
    return this.ordersService.createOrder(req.user.id, req.headers['x-tenant-id'], body.items);
  }

  @Get()
  getMyOrders(@Req() req: any) { return this.ordersService.getMyOrders(req.user.id); }

  @Get(':id')
  getOrder(@Param('id') id: string, @Req() req: any) { return this.ordersService.getOrderById(id, req.user.id); }

  @Post(':id/confirm-payment')
  @Roles('super-admin', 'platform-admin')
  confirmPayment(@Param('id') id: string, @Req() req: any) {
    return this.ordersService.confirmPayment(id, req.user.id);
  }
}
