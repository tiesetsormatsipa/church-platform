import { Module } from '@nestjs/common';
import { AdminMembershipsService } from './admin-memberships.service.js';
import { AdminMembershipsController, AdminUsersController } from './admin-people.controller.js';
import { AdminUsersService } from './admin-users.service.js';

@Module({
  controllers: [AdminMembershipsController, AdminUsersController],
  providers: [AdminMembershipsService, AdminUsersService],
})
export class AdminPeopleModule {}
