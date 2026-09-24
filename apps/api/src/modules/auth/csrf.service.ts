import { Inject, Injectable } from '@nestjs/common';
import { randomToken, safeCompare } from '@church/infrastructure/tokens';
import { CSRF_HEADER } from '@church/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { APP_CONFIG, type AppConfig } from '../../config/env.js';

/**
 * Double-submit CSRF token: a random value in a JavaScript-readable cookie that the client
 * echoes in the `X-CSRF-Token` header. Combined with the Origin check in `CsrfGuard`.
 */
@Injectable()
export class CsrfService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  current(request: FastifyRequest): string | undefined {
    return request.cookies[this.config.cookies.csrfName];
  }

  issue(reply: FastifyReply): string {
    const token = randomToken(24);
    void reply.setCookie(this.config.cookies.csrfName, token, {
      path: '/',
      httpOnly: false,
      secure: this.config.cookies.secure,
      sameSite: 'lax',
    });
    return token;
  }

  /** Return the existing token or issue a new one. */
  ensure(request: FastifyRequest, reply: FastifyReply): string {
    return this.current(request) ?? this.issue(reply);
  }

  verify(request: FastifyRequest): boolean {
    const cookie = this.current(request);
    const header = request.headers[CSRF_HEADER];
    if (!cookie || typeof header !== 'string' || header.length === 0) return false;
    return safeCompare(cookie, header);
  }
}
