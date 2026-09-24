import { Controller, Get, Patch, Param, Query, Req, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  getMyNotifications(@Req() req: any, @Query('page') page = 1, @Query('limit') limit = 30) {
    return this.notificationsService.getUserNotifications(req.user.id, +page, +limit);
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    const count = await this.notificationsService.getUnreadCount(req.user.id);
    return { count };
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @Req() req: any) {
    return this.notificationsService.markRead(id, req.user.id);
  }

  @Post('mark-all-read')
  markAllRead(@Req() req: any) {
    return this.notificationsService.markAllRead(req.user.id);
  }
}
