import { Controller, Get, Post, Body, Param, Query, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MessagingService } from './messaging.service';
import { Feature } from '../../common/decorators/feature.decorator';

@ApiTags('messaging')
@ApiBearerAuth()
@Feature('messaging')
@Controller({ path: 'messaging', version: '1' })
export class MessagingController {
  constructor(private messagingService: MessagingService) {}

  @Get('conversations')
  getConversations(@Req() req: any, @Query('tab') tab = 'members', @Query('search') search?: string) {
    return this.messagingService.getUserConversations(req.user.id, tab, search);
  }

  @Get('conversations/:id/messages')
  getMessages(@Param('id') id: string, @Req() req: any, @Query('page') page = 1, @Query('limit') limit = 50) {
    return this.messagingService.getConversationMessages(id, req.user.id, +page, +limit);
  }

  @Post('messages')
  sendMessage(@Req() req: any, @Body() body: { conversationId: string; content: string; type?: string; attachmentIds?: string[] }) {
    return this.messagingService.sendMessage({ ...body, senderId: req.user.id });
  }

  @Post('conversations/direct')
  createDirect(@Req() req: any, @Body() body: { targetUserId: string }) {
    return this.messagingService.createDirectConversation(req.user.id, body.targetUserId);
  }

  @Post('conversations/:id/read')
  markRead(@Param('id') id: string, @Req() req: any) {
    return this.messagingService.markConversationRead(id, req.user.id);
  }
}
