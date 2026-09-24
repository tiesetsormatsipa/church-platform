import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { RATE_LIMIT, type RateLimitRule } from '../../common/decorators/index.js';
import { Errors } from '../../common/http/errors.js';
import { RateLimitService } from '../core/rate-limit.service.js';

/** A generous per-IP ceiling for every route, plus stricter rules declared with @RateLimit(). */
const GLOBAL_RULE: RateLimitRule = { name: 'global', limit: 600, windowSeconds: 60 };

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const rules = [
      GLOBAL_RULE,
      ...(this.reflector.getAllAndOverride<RateLimitRule[] | undefined>(RATE_LIMIT, [
        context.getHandler(),
        context.getClass(),
      ]) ?? []),
    ];
    for (const rule of rules) {
      // Rules keyed by user run after authentication resolved the principal; before that
      // (or for anonymous callers) they fall back to the IP.
      const subject = rule.by === 'user' && request.principal ? `u:${request.principal.userId}` : `ip:${request.ip}`;
      const result = await this.limiter.hit(`${rule.name}:${subject}`, rule.limit, rule.windowSeconds * 1000);
      if (!result.allowed) throw Errors.tooManyRequests(result.retryAfterMs / 1000);
    }
    return true;
  }
}
