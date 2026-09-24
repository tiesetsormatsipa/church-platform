import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { APP_CONFIG, type AppConfig } from '../../config/env.js';
import { IS_PUBLIC, REQUIRE_VERIFIED_EMAIL } from '../../common/decorators/index.js';
import { Errors } from '../../common/http/errors.js';
import { SessionService } from './session.service.js';

/**
 * Resolves the session cookie on every HTTP request. Routes are private unless marked
 * `@Public()`; public routes still see the principal when a valid session exists.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const http = context.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets) ?? false;

    const token = request.cookies[this.config.cookies.sessionName];
    if (token && !request.principal) {
      const principal = await this.sessions.resolve(token);
      if (principal) {
        request.principal = principal;
      } else {
        // Stale or revoked cookie: remove it so the browser stops sending it.
        void http.getResponse<FastifyReply>().clearCookie(this.config.cookies.sessionName, { path: '/' });
      }
    }

    if (!request.principal) {
      if (isPublic) return true;
      throw Errors.unauthenticated();
    }

    const requiresVerified = this.reflector.getAllAndOverride<boolean>(REQUIRE_VERIFIED_EMAIL, targets) ?? false;
    if (requiresVerified && !request.principal.emailVerified) {
      throw Errors.forbidden('Please verify your e-mail address first.', 'EMAIL_NOT_VERIFIED');
    }
    return true;
  }
}
