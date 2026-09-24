import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { APP_CONFIG, type AppConfig } from '../../config/env.js';
import { Errors } from '../../common/http/errors.js';
import { CsrfService } from './csrf.service.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF protection for cookie-authenticated requests:
 *  1. the Origin (or Sec-Fetch-Site) must be ours, and
 *  2. the double-submit token must match.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly csrf: CsrfService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    if (SAFE_METHODS.has(request.method)) return true;

    const origin = request.headers.origin;
    if (origin) {
      if (!this.config.trustedOrigins.includes(origin)) throw Errors.csrf();
    } else {
      const site = request.headers['sec-fetch-site'];
      if (typeof site === 'string' && site !== 'same-origin' && site !== 'none') throw Errors.csrf();
    }

    if (!this.csrf.verify(request)) throw Errors.csrf();
    return true;
  }
}
