import { Controller, Get, Patch, Post, Body, Param, Query, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me/profile')
  getMyProfile(@Req() req: any) { return this.usersService.getMyProfile(req.user.id); }

  @Patch('me/profile')
  updateMyProfile(@Req() req: any, @Body() body: any) { return this.usersService.updateMyProfile(req.user.id, body); }

  @Post('me/verification')
  submitVerification(@Req() req: any) { return this.usersService.submitVerification(req.user.id); }

  @Get('admin/list')
  @Roles('super-admin', 'platform-admin', 'branch-admin', 'membership-verifier')
  listUsers(@Req() req: any, @Query('search') search?: string, @Query('verificationStatus') verificationStatus?: string,
    @Query('page') page = 1, @Query('limit') limit = 20) {
    return this.usersService.listUsers({ search, verificationStatus, page: +page, limit: +limit, tenantId: req.headers['x-tenant-id'] });
  }

  @Get('admin/verification-queue')
  @Roles('super-admin', 'platform-admin', 'membership-verifier', 'branch-admin')
  verificationQueue() { return this.usersService.getPendingVerifications(); }

  @Post('admin/:id/verify')
  @Roles('super-admin', 'platform-admin', 'membership-verifier')
  approve(@Param('id') id: string, @Req() req: any, @Body() body: { notes?: string }) {
    return this.usersService.approveVerification(id, req.user.id, body.notes);
  }

  @Post('admin/:id/reject')
  @Roles('super-admin', 'platform-admin', 'membership-verifier')
  reject(@Param('id') id: string, @Req() req: any, @Body() body: { reason: string }) {
    return this.usersService.rejectVerification(id, req.user.id, body.reason);
  }

  @Post('admin/:userId/roles')
  @Roles('super-admin', 'platform-admin')
  assignRole(@Param('userId') userId: string, @Body() body: { roleSlug: string }, @Req() req: any) {
    return this.usersService.assignRole(userId, body.roleSlug, req.user.id);
  }
}
