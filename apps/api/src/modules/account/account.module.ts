import { Module } from '@nestjs/common';
import { AccountController } from './account.controller.js';
import { AccountService } from './account.service.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  controllers: [AccountController],
  providers: [AccountService, NotificationsService],
})
export class AccountModule {}
