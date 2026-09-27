import { Controller, Get, Inject, Query, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Public, Meta, RateLimit } from '../../common/decorators/index.js';
import { Errors } from '../../common/http/errors.js';
import type { RequestMeta } from '../../common/principal.js';
import { APP_CONFIG, type AppConfig } from '../../config/env.js';
import { AuthService } from './auth.service.js';
import { GoogleAuthService, FLOW_TTL_SECONDS } from './google.service.js';

/** Names the flow this browser started. Read once, on the way back from Google. */
const TICKET_COOKIE = 'cp_oauth';

/**
 * Only same-site paths, so a crafted `next` cannot bounce a freshly signed-in visitor off
 * to somebody else's site.
 */
function safePath(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string' || value.length > 512 || !value.startsWith('/')) return fallback;
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback;
  for (let i = 0; i < value.length; i += 1) if (value.charCodeAt(i) < 32) return fallback;
  return value;
}

/**
 * Google sign-in.
 *
 * Two plain redirects rather than JSON, because the browser has to leave the site and come
 * back; there is nothing here for the typed client to call. Excluded from the OpenAPI
 * document for the same reason.
 */
@ApiExcludeController()
@Controller({ path: 'auth/google', version: '1' })
export class GoogleAuthController {
  constructor(
    private readonly google: GoogleAuthService,
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get('start')
  @Public()
  @RateLimit({ name: 'auth.google.start', limit: 20, windowSeconds: 900, by: 'ip' })
  async start(
    @Query('next') next: string | undefined,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    if (!this.google.enabled) throw Errors.notFound('That page');
    const { url, ticket } = await this.google.start(safePath(next));
    void reply.setCookie(TICKET_COOKIE, ticket, {
      path: '/',
      httpOnly: true,
      secure: this.config.cookies.secure,
      // Lax, not Strict: the browser arrives back from Google on a cross-site redirect and
      // must still be carrying this.
      sameSite: 'lax',
      maxAge: FLOW_TTL_SECONDS,
    });
    return reply.redirect(url, 302);
  }

  @Get('callback')
  @Public()
  @RateLimit({ name: 'auth.google.callback', limit: 20, windowSeconds: 900, by: 'ip' })
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Meta() meta: RequestMeta,
  ) {
    if (!this.google.enabled) throw Errors.notFound('That page');

    const ticket = request.cookies[TICKET_COOKIE];
    void reply.clearCookie(TICKET_COOKIE, { path: '/' });

    // Someone pressed "cancel" on Google's screen. Not an error worth a page of its own.
    if (error) return reply.redirect(this.signInWith('cancelled'), 302);

    const flow = ticket ? await this.google.recall(ticket) : null;
    if (!flow || !state || state !== flow.state || !code) {
      return reply.redirect(this.signInWith('expired'), 302);
    }

    try {
      const profile = await this.google.exchange(code, flow);
      const { userId } = await this.google.resolveUser(profile, meta);
      await this.auth.startSessionFor(userId, meta, reply);
      return reply.redirect(`${this.config.appOrigin}${safePath(flow.next)}`, 302);
    } catch {
      // The reason is already recorded server-side; the visitor gets one honest sentence
      // rather than an OAuth error code they can do nothing with.
      return reply.redirect(this.signInWith('failed'), 302);
    }
  }

  private signInWith(reason: 'cancelled' | 'expired' | 'failed'): string {
    return `${this.config.appOrigin}/sign-in?google=${reason}`;
  }
}
