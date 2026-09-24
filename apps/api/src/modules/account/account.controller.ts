import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AccountProfile,
  MarkNotificationsRead,
  MembershipDto,
  MembershipRequest,
  NotificationPreferences,
  NotificationsPage,
  NotificationsQuery,
  NotificationsUnread,
  UpdateNotificationPreferences,
  UpdateProfileRequest,
  Uuid,
} from '@church/shared';
import type { z } from 'zod';
import { ApiResult, CurrentUser, Meta, RateLimit } from '../../common/decorators/index.js';
import type { Principal, RequestMeta } from '../../common/principal.js';
import { AccountService } from './account.service.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('account')
@Controller({ path: 'me', version: '1' })
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get('profile')
  @ApiOperation({ summary: 'Your profile and branch memberships.' })
  @ApiResult(AccountProfile)
  profile(@CurrentUser() principal: Principal) {
    return this.account.profile(principal);
  }

  @Patch('profile')
  @RateLimit({ name: 'account.profile', limit: 30, windowSeconds: 3600, by: 'user' })
  @ApiOperation({ summary: 'Update your profile (omitted fields are unchanged).' })
  @ApiResult(AccountProfile)
  updateProfile(
    @CurrentUser() principal: Principal,
    @Body({ schema: UpdateProfileRequest }) body: z.output<typeof UpdateProfileRequest>,
    @Meta() meta: RequestMeta,
  ) {
    return this.account.updateProfile(principal, body, meta);
  }

  @Post('memberships')
  @HttpCode(201)
  @RateLimit({ name: 'account.membership', limit: 10, windowSeconds: 3600, by: 'user' })
  @ApiOperation({ summary: 'Ask to join a branch; its administrators review the request.' })
  @ApiResult(MembershipDto, { status: 201 })
  requestMembership(
    @CurrentUser() principal: Principal,
    @Body({ schema: MembershipRequest }) body: z.output<typeof MembershipRequest>,
    @Meta() meta: RequestMeta,
  ) {
    return this.account.requestMembership(principal, body, meta);
  }

  @Delete('memberships/:id')
  @ApiOperation({ summary: 'Withdraw a pending request or leave a branch.' })
  @ApiResult(MembershipDto)
  leaveMembership(
    @CurrentUser() principal: Principal,
    @Param('id', { schema: Uuid }) id: string,
    @Meta() meta: RequestMeta,
  ) {
    return this.account.leaveMembership(principal, id, meta);
  }

  @Get('notification-preferences')
  @ApiResult(NotificationPreferences)
  preferences(@CurrentUser() principal: Principal) {
    return this.account.preferences(principal);
  }

  @Put('notification-preferences')
  @ApiOperation({
    summary: 'Choose how you hear about each kind of update. Security e-mails always stay on.',
  })
  @ApiResult(NotificationPreferences)
  updatePreferences(
    @CurrentUser() principal: Principal,
    @Body({ schema: UpdateNotificationPreferences })
    body: z.output<typeof UpdateNotificationPreferences>,
  ) {
    return this.account.updatePreferences(principal, body);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Your notifications, newest first.' })
  @ApiResult(NotificationsPage)
  listNotifications(
    @CurrentUser() principal: Principal,
    @Query({ schema: NotificationsQuery }) query: z.output<typeof NotificationsQuery>,
  ) {
    return this.notifications.list(principal, query);
  }

  @Get('notifications/unread')
  @ApiOperation({ summary: 'How many notifications you have not read.' })
  @ApiResult(NotificationsUnread)
  unreadNotifications(@CurrentUser() principal: Principal) {
    return this.notifications.unreadCount(principal);
  }

  @Post('notifications/read')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark notifications as read.' })
  @ApiResult(NotificationsUnread)
  markNotificationsRead(
    @CurrentUser() principal: Principal,
    @Body({ schema: MarkNotificationsRead }) body: z.output<typeof MarkNotificationsRead>,
  ) {
    return this.notifications.markRead(principal, body);
  }
}
