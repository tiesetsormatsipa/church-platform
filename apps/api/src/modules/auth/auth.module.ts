import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthTokenService } from './auth-token.service.js';
import { AuthService } from './auth.service.js';
import { CsrfGuard } from './csrf.guard.js';
import { CsrfService } from './csrf.service.js';
import { RateLimitGuard } from './rate-limit.guard.js';
import { SessionAuthGuard } from './session-auth.guard.js';
import { SessionService } from './session.service.js';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthTokenService, CsrfService, SessionService, SessionAuthGuard, CsrfGuard, RateLimitGuard],
  exports: [AuthService, CsrfService, SessionService, SessionAuthGuard, CsrfGuard, RateLimitGuard],
})
export class AuthModule {}
