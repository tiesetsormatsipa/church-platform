import { Module } from '@nestjs/common';
import { AdminBaptismService } from './admin-baptism.service.js';
import { AdminMembershipsService } from './admin-memberships.service.js';
import {
  AdminBaptismController,
  AdminMembershipsController,
  AdminUsersController,
} from './admin-people.controller.js';
import { AdminUsersService } from './admin-users.service.js';

@Module({
  controllers: [AdminMembershipsController, AdminBaptismController, AdminUsersController],
  providers: [AdminMembershipsService, AdminBaptismService, AdminUsersService],
})
export class AdminPeopleModule {}
