import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ConversationList,
  ConversationsQuery,
  DirectoryList,
  DirectoryQuery,
  MessageResult,
  MessagesPage,
  MessagesQuery,
  SendMessageRequest,
  StartConversation,
  UnreadMessages,
  Uuid,
} from '@church/shared';
import type { z } from 'zod';
import {
  ApiResult,
  CurrentUser,
  Meta,
  RateLimit,
  RequireVerifiedEmail,
} from '../../common/decorators/index.js';
import type { Principal, RequestMeta } from '../../common/principal.js';
import { MessagingService } from './messaging.service.js';

/**
 * Writing to another member is not an administrative act, so there is no permission to hold:
 * a confirmed address and an active membership are the whole of it. The service decides who
 * is reachable.
 */
@ApiTags('messaging')
@RequireVerifiedEmail()
@Controller({ path: 'me/messages', version: '1' })
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Get()
  @ApiOperation({ summary: 'Your conversations, most recently used first.' })
  @ApiResult(ConversationList)
  list(
    @CurrentUser() principal: Principal,
    @Query({ schema: ConversationsQuery }) query: z.output<typeof ConversationsQuery>,
  ) {
    return this.messaging.list(principal, query);
  }

  @Get('unread')
  @ApiOperation({ summary: 'How many messages you have not read.' })
  @ApiResult(UnreadMessages)
  unread(@CurrentUser() principal: Principal) {
    return this.messaging.unread(principal);
  }

  @Get('directory')
  @RateLimit({ name: 'messaging.directory', limit: 120, windowSeconds: 3600, by: 'user' })
  @ApiOperation({ summary: 'Members you may write to: people at a branch you belong to.' })
  @ApiResult(DirectoryList)
  directory(
    @CurrentUser() principal: Principal,
    @Query({ schema: DirectoryQuery }) query: z.output<typeof DirectoryQuery>,
  ) {
    return this.messaging.directory(principal, query);
  }

  @Post()
  @HttpCode(201)
  @RateLimit({ name: 'messaging.start', limit: 20, windowSeconds: 3600, by: 'user' })
  @ApiOperation({ summary: 'Write to a member, starting a thread or continuing the one you have.' })
  @ApiResult(MessageResult, { status: 201 })
  start(
    @CurrentUser() principal: Principal,
    @Body({ schema: StartConversation }) body: z.output<typeof StartConversation>,
    @Meta() meta: RequestMeta,
  ) {
    return this.messaging.start(principal, body, meta);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One thread, oldest message first.' })
  @ApiResult(MessagesPage)
  thread(
    @Param('id', { schema: Uuid }) id: string,
    @CurrentUser() principal: Principal,
    @Query({ schema: MessagesQuery }) query: z.output<typeof MessagesQuery>,
  ) {
    return this.messaging.thread(principal, id, query);
  }

  @Post(':id/messages')
  @HttpCode(201)
  @RateLimit({ name: 'messaging.send', limit: 120, windowSeconds: 3600, by: 'user' })
  @ApiOperation({ summary: 'Add a message to a thread you are in.' })
  @ApiResult(MessageResult, { status: 201 })
  send(
    @Param('id', { schema: Uuid }) id: string,
    @CurrentUser() principal: Principal,
    @Body({ schema: SendMessageRequest }) body: z.output<typeof SendMessageRequest>,
    @Meta() meta: RequestMeta,
  ) {
    return this.messaging.send(principal, id, body, meta);
  }

  @Post(':id/read')
  @HttpCode(204)
  @ApiOperation({ summary: 'Mark everything in a thread as read.' })
  async read(@Param('id', { schema: Uuid }) id: string, @CurrentUser() principal: Principal) {
    await this.messaging.markRead(principal, id);
  }
}
