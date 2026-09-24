import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AcceptedResponse,
  ChangePasswordRequest,
  CsrfResponse,
  DeviceSessionList,
  EmailOnlyRequest,
  LoginRequest,
  OkResponse,
  RegisterRequest,
  ResetPasswordRequest,
  SessionResponse,
  SessionUser,
  TokenRequest,
  Uuid,
} from '@church/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';
import {
  ApiResult,
  CurrentUser,
  Meta,
  Public,
  RateLimit,
} from '../../common/decorators/index.js';
import { Errors } from '../../common/http/errors.js';
import type { Principal, RequestMeta } from '../../common/principal.js';
import { AuthService } from './auth.service.js';
import { CsrfService } from './csrf.service.js';
import { SessionService } from './session.service.js';

const HOUR = 3600;

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly csrf: CsrfService,
  ) {}

  @Public()
  @Get('session')
  @ApiOperation({ summary: 'Current session (user is null when signed out). Also issues the CSRF cookie.' })
  @ApiResult(SessionResponse)
  async session(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    this.csrf.ensure(request, reply);
    void reply.header('cache-control', 'no-store');
    return { user: request.principal ? await this.auth.sessionUser(request.principal) : null };
  }

  @Public()
  @Get('csrf')
  @ApiOperation({ summary: 'Return the CSRF token, issuing the cookie if needed.' })
  @ApiResult(CsrfResponse)
  csrfToken(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    void reply.header('cache-control', 'no-store');
    return { token: this.csrf.ensure(request, reply) };
  }

  @Public()
  @Post('register')
  @HttpCode(202)
  @RateLimit({ name: 'auth.register', limit: 10, windowSeconds: HOUR })
  @ApiOperation({ summary: 'Create an account. Always accepted; a confirmation e-mail follows.' })
  @ApiResult(AcceptedResponse, { status: 202 })
  register(@Body({ schema: RegisterRequest }) body: z.output<typeof RegisterRequest>, @Meta() meta: RequestMeta) {
    return this.auth.register(body, meta);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(200)
  @RateLimit({ name: 'auth.verify', limit: 30, windowSeconds: HOUR })
  @ApiOperation({ summary: 'Confirm an e-mail address with the e-mailed token and sign in.' })
  @ApiResult(SessionUser)
  verifyEmail(
    @Body({ schema: TokenRequest }) body: z.output<typeof TokenRequest>,
    @Meta() meta: RequestMeta,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.auth.verifyEmail(body.token, meta, reply);
  }

  @Public()
  @Post('verify-email/resend')
  @HttpCode(202)
  @RateLimit({ name: 'auth.verify-resend', limit: 5, windowSeconds: HOUR })
  @ApiResult(AcceptedResponse, { status: 202 })
  resendVerification(@Body({ schema: EmailOnlyRequest }) body: z.output<typeof EmailOnlyRequest>, @Meta() meta: RequestMeta) {
    return this.auth.resendVerification(body.email, meta);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in with e-mail and password.' })
  @ApiResult(SessionUser)
  login(
    @Body({ schema: LoginRequest }) body: z.output<typeof LoginRequest>,
    @Meta() meta: RequestMeta,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.auth.login(body, meta, reply);
  }

  @Post('logout')
  @HttpCode(200)
  @ApiResult(OkResponse)
  async logout(@CurrentUser() principal: Principal, @Meta() meta: RequestMeta, @Res({ passthrough: true }) reply: FastifyReply) {
    await this.auth.logout(principal, meta, reply);
    return { ok: true as const };
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(202)
  @RateLimit({ name: 'auth.forgot', limit: 10, windowSeconds: HOUR })
  @ApiResult(AcceptedResponse, { status: 202 })
  forgotPassword(@Body({ schema: EmailOnlyRequest }) body: z.output<typeof EmailOnlyRequest>, @Meta() meta: RequestMeta) {
    return this.auth.forgotPassword(body.email, meta);
  }

  @Public()
  @Post('password/reset')
  @HttpCode(200)
  @RateLimit({ name: 'auth.reset', limit: 20, windowSeconds: HOUR })
  @ApiResult(SessionUser)
  resetPassword(
    @Body({ schema: ResetPasswordRequest }) body: z.output<typeof ResetPasswordRequest>,
    @Meta() meta: RequestMeta,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.auth.resetPassword(body, meta, reply);
  }

  @Post('password/change')
  @HttpCode(200)
  @RateLimit({ name: 'auth.change-password', limit: 10, windowSeconds: HOUR, by: 'user' })
  @ApiResult(OkResponse)
  async changePassword(
    @CurrentUser() principal: Principal,
    @Body({ schema: ChangePasswordRequest }) body: z.output<typeof ChangePasswordRequest>,
    @Meta() meta: RequestMeta,
  ) {
    await this.auth.changePassword(principal, body, meta);
    return { ok: true as const };
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Signed-in devices of the current user.' })
  @ApiResult(DeviceSessionList)
  async listSessions(@CurrentUser() principal: Principal) {
    const sessions = await this.sessions.listActive(principal.userId);
    return {
      items: sessions.map((s) => ({
        id: s.id,
        current: s.id === principal.sessionId,
        userAgent: s.userAgent,
        ipAddress: s.ipAddress,
        createdAt: s.createdAt.toISOString(),
        lastSeenAt: s.lastSeenAt.toISOString(),
      })),
    };
  }

  @Delete('sessions/:id')
  @ApiOperation({ summary: 'Sign out one device.' })
  @ApiResult(OkResponse)
  async revokeSession(
    @CurrentUser() principal: Principal,
    @Param('id', { schema: Uuid }) id: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const owned = (await this.sessions.listActive(principal.userId)).some((s) => s.id === id);
    if (!owned) throw Errors.notFound('That session');
    await this.sessions.revoke(id, 'user_revoked');
    if (id === principal.sessionId) this.auth.clearSessionCookie(reply);
    return { ok: true as const };
  }

  @Post('sessions/revoke-others')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign out every other device.' })
  @ApiResult(OkResponse)
  async revokeOthers(@CurrentUser() principal: Principal) {
    await this.sessions.revokeAll(principal.userId, 'user_revoked_others', { exceptSessionId: principal.sessionId });
    return { ok: true as const };
  }
}
