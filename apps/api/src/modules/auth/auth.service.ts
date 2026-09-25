import { Inject, Injectable, Logger } from '@nestjs/common';
import type { DatabaseClient, NotificationCategory } from '@church/database';
import {
  hashPassword,
  needsRehash,
  timingDummyHash,
  verifyPassword,
} from '@church/infrastructure/password';
import { JobProducer } from '@church/infrastructure/queue';
import { sha256Hex } from '@church/infrastructure/tokens';
import {
  type AcceptedResponse,
  type EmailMessage,
  NotificationCategory as NotificationCategoryEnum,
  type SessionUser,
} from '@church/shared';
import type { FastifyReply } from 'fastify';
import type { z } from 'zod';
import type {
  ChangePasswordRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
} from '@church/shared';
import { APP_CONFIG, type AppConfig } from '../../config/env.js';
import { Errors } from '../../common/http/errors.js';
import type { Principal, RequestMeta } from '../../common/principal.js';
import { DATABASE } from '../../infrastructure/tokens.js';
import { AuditService } from '../core/audit.service.js';
import { MEDIA_URL_SELECT, MediaUrlService } from '../core/media-urls.service.js';
import { OrganizationService } from '../core/organization.service.js';
import { RateLimitService } from '../core/rate-limit.service.js';
import { AuthTokenService } from './auth-token.service.js';
import { CsrfService } from './csrf.service.js';
import { SessionService } from './session.service.js';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_FAILURES_BEFORE_LOCK = 5;
const LOGIN_IP_LIMIT = 30;
const MAX_LOCK_MINUTES = 60;

const ACCEPTED_REGISTER: AcceptedResponse = {
  status: 'accepted',
  message: 'Check your inbox: we have sent a link to confirm your e-mail address.',
};
const ACCEPTED_RESET: AcceptedResponse = {
  status: 'accepted',
  message: 'If an account uses that address, we have sent it a link to choose a new password.',
};
const ACCEPTED_RESEND: AcceptedResponse = {
  status: 'accepted',
  message: 'If that address is waiting for confirmation, we have sent a new link.',
};

type LoginInput = z.output<typeof LoginRequest>;
type RegisterInput = z.output<typeof RegisterRequest>;
type ResetInput = z.output<typeof ResetPasswordRequest>;
type ChangeInput = z.output<typeof ChangePasswordRequest>;

/**
 * Registration, sign-in, e-mail verification and password management.
 *
 * Privacy: church membership is sensitive personal information (POPIA), so registration,
 * password reset and verification resend never reveal whether an address has an account.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly sessions: SessionService,
    private readonly tokens: AuthTokenService,
    private readonly csrf: CsrfService,
    private readonly limiter: RateLimitService,
    private readonly audit: AuditService,
    private readonly organizations: OrganizationService,
    private readonly mediaUrls: MediaUrlService,
    private readonly jobs: JobProducer,
  ) {}

  // ---------------------------------------------------------------------------------------
  // Registration and verification
  // ---------------------------------------------------------------------------------------

  async register(input: RegisterInput, meta: RequestMeta): Promise<AcceptedResponse> {
    const organization = await this.organizations.current();
    if (!organization.parsedSettings.registrationOpen) {
      throw Errors.forbidden('New registrations are currently closed.', 'REGISTRATION_CLOSED');
    }

    // Hash before looking the address up so both paths take similar time.
    const passwordHash = await hashPassword(input.password);
    const existing = await this.db.user.findUnique({
      where: { email: input.email },
      select: {
        id: true,
        emailVerifiedAt: true,
        deletedAt: true,
        profile: { select: { firstName: true } },
      },
    });

    if (existing && !existing.deletedAt) {
      if (existing.emailVerifiedAt) {
        await this.sendEmail(
          {
            template: 'account-exists',
            to: input.email,
            data: {
              firstName: existing.profile?.firstName ?? input.firstName,
              signInUrl: this.link('/sign-in'),
              resetUrl: this.link('/forgot-password'),
            },
          },
          existing.id,
          meta,
        );
      } else {
        await this.sendVerification(
          existing.id,
          input.email,
          existing.profile?.firstName ?? input.firstName,
          meta,
        );
      }
      return ACCEPTED_REGISTER;
    }
    if (existing?.deletedAt) return ACCEPTED_REGISTER;

    const settings = organization.parsedSettings;
    const now = new Date();
    const user = await this.db.user.create({
      data: {
        email: input.email,
        passwordHash,
        passwordChangedAt: now,
        profile: {
          create: {
            firstName: input.firstName,
            lastName: input.lastName,
            termsAcceptedAt: now,
            privacyConsentAt: now,
          },
        },
        notificationPreferences: {
          create: NotificationCategoryEnum.values.map((category: NotificationCategory) => ({
            category,
            inApp: category === 'ACCOUNT' || settings.defaultInAppCategories.includes(category),
            email: category === 'ACCOUNT' || settings.defaultEmailCategories.includes(category),
          })),
        },
      },
      select: { id: true },
    });
    await this.audit.record({
      organizationId: organization.id,
      actorId: user.id,
      action: 'auth.register',
      entityType: 'User',
      entityId: user.id,
      meta,
    });
    await this.sendVerification(user.id, input.email, input.firstName, meta);
    return ACCEPTED_REGISTER;
  }

  async resendVerification(email: string, meta: RequestMeta): Promise<AcceptedResponse> {
    const user = await this.db.user.findUnique({
      where: { email },
      select: {
        id: true,
        emailVerifiedAt: true,
        deletedAt: true,
        status: true,
        profile: { select: { firstName: true } },
      },
    });
    if (user && !user.emailVerifiedAt && !user.deletedAt && user.status === 'ACTIVE') {
      await this.sendVerification(user.id, email, user.profile?.firstName ?? '', meta);
    }
    return ACCEPTED_RESEND;
  }

  /** Confirms the address and signs the user in (the link proves control of the inbox). */
  async verifyEmail(token: string, meta: RequestMeta, reply: FastifyReply): Promise<SessionUser> {
    const userId = await this.tokens.consume(token, 'EMAIL_VERIFICATION');
    if (!userId) {
      throw Errors.badRequest(
        'TOKEN_INVALID',
        'This link has expired or has already been used. Request a new one.',
      );
    }
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { status: true, emailVerifiedAt: true },
    });
    if (!user || user.status !== 'ACTIVE')
      throw Errors.forbidden('This account is not active.', 'ACCOUNT_INACTIVE');
    if (!user.emailVerifiedAt) {
      await this.db.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
    }
    await this.audit.record({
      actorId: userId,
      action: 'auth.email_verified',
      entityType: 'User',
      entityId: userId,
      meta,
    });
    return this.startSession(userId, { rememberMe: false, meta }, reply);
  }

  // ---------------------------------------------------------------------------------------
  // Sign-in / sign-out
  // ---------------------------------------------------------------------------------------

  async login(input: LoginInput, meta: RequestMeta, reply: FastifyReply): Promise<SessionUser> {
    const emailKey = `login:email:${sha256Hex(input.email)}`;
    const ipResult = await this.limiter.hit(
      `login:ip:${meta.ip ?? 'unknown'}`,
      LOGIN_IP_LIMIT,
      LOGIN_WINDOW_MS,
    );
    if (!ipResult.allowed)
      throw Errors.tooManyRequests(ipResult.retryAfterMs / 1000, lockedMessage());

    const user = await this.db.user.findUnique({
      where: { email: input.email },
      select: {
        id: true,
        passwordHash: true,
        status: true,
        deletedAt: true,
        emailVerifiedAt: true,
        failedLoginCount: true,
        lockedUntil: true,
      },
    });

    const now = Date.now();
    if (user?.lockedUntil && user.lockedUntil.getTime() > now) {
      throw Errors.tooManyRequests((user.lockedUntil.getTime() - now) / 1000, lockedMessage());
    }
    const recentFailures = await this.limiter.count(emailKey);
    if (recentFailures.count >= LOGIN_FAILURES_BEFORE_LOCK && !user) {
      // Unknown addresses are throttled exactly like locked accounts.
      throw Errors.tooManyRequests(recentFailures.ttlMs / 1000, lockedMessage());
    }

    let passwordOk = false;
    if (user && !user.deletedAt && user.passwordHash) {
      passwordOk = await verifyPassword(user.passwordHash, input.password);
    } else {
      // Spend the same time as a real check so response timing does not reveal accounts.
      await verifyPassword(await timingDummyHash(), input.password);
    }

    if (!user || !passwordOk || user.deletedAt) {
      await this.limiter.hit(emailKey, Number.MAX_SAFE_INTEGER, LOGIN_WINDOW_MS);
      if (user && !user.deletedAt)
        await this.recordFailedLogin(user.id, user.failedLoginCount + 1, meta);
      throw Errors.invalidCredentials();
    }

    if (user.status !== 'ACTIVE') {
      throw Errors.forbidden(
        'This account has been suspended. Please contact the church office.',
        'ACCOUNT_SUSPENDED',
      );
    }
    if (!user.emailVerifiedAt) {
      throw Errors.forbidden(
        'Please confirm your e-mail address first. We can send you a new link.',
        'EMAIL_NOT_VERIFIED',
      );
    }

    await this.limiter.reset(emailKey);
    const upgradedHash = needsRehash(user.passwordHash!)
      ? await hashPassword(input.password)
      : null;
    await this.db.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        ...(upgradedHash ? { passwordHash: upgradedHash } : {}),
      },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'auth.login',
      entityType: 'User',
      entityId: user.id,
      ...(upgradedHash ? { summary: 'Password hash upgraded to argon2id' } : {}),
      meta,
    });
    return this.startSession(user.id, { rememberMe: input.rememberMe, meta }, reply);
  }

  async logout(principal: Principal, meta: RequestMeta, reply: FastifyReply): Promise<void> {
    await this.sessions.revoke(principal.sessionId, 'logout');
    this.clearSessionCookie(reply);
    this.csrf.issue(reply);
    await this.audit.record({
      actorId: principal.userId,
      action: 'auth.logout',
      entityType: 'Session',
      entityId: principal.sessionId,
      meta,
    });
  }

  // ---------------------------------------------------------------------------------------
  // Passwords
  // ---------------------------------------------------------------------------------------

  async forgotPassword(email: string, meta: RequestMeta): Promise<AcceptedResponse> {
    const limit = await this.limiter.hit(`reset:email:${sha256Hex(email)}`, 3, 60 * 60 * 1000);
    if (!limit.allowed) return ACCEPTED_RESET;
    const user = await this.db.user.findUnique({
      where: { email },
      select: { id: true, status: true, deletedAt: true, profile: { select: { firstName: true } } },
    });
    if (user && user.status === 'ACTIVE' && !user.deletedAt) {
      const { token, expiresInMinutes } = await this.tokens.issue(user.id, 'PASSWORD_RESET', email);
      await this.sendEmail(
        {
          template: 'password-reset',
          to: email,
          data: {
            firstName: user.profile?.firstName ?? '',
            resetUrl: this.link(`/reset-password?token=${encodeURIComponent(token)}`),
            expiresInMinutes,
          },
        },
        user.id,
        meta,
      );
      await this.audit.record({
        actorId: user.id,
        action: 'auth.password_reset_requested',
        entityType: 'User',
        entityId: user.id,
        meta,
      });
    }
    return ACCEPTED_RESET;
  }

  async resetPassword(
    input: ResetInput,
    meta: RequestMeta,
    reply: FastifyReply,
  ): Promise<SessionUser> {
    const userId = await this.tokens.consume(input.token, 'PASSWORD_RESET');
    if (!userId) {
      throw Errors.badRequest(
        'TOKEN_INVALID',
        'This link has expired or has already been used. Request a new one.',
      );
    }
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        status: true,
        emailVerifiedAt: true,
        profile: { select: { firstName: true } },
      },
    });
    if (!user || user.status !== 'ACTIVE')
      throw Errors.forbidden('This account is not active.', 'ACCOUNT_INACTIVE');

    const passwordHash = await hashPassword(input.password);
    await this.db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
          failedLoginCount: 0,
          lockedUntil: null,
          // Following the e-mailed link proves control of the inbox.
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        },
      });
      await this.sessions.revokeAll(userId, 'password_reset', {}, tx);
    });
    await this.limiter.reset(`login:email:${sha256Hex(user.email)}`);
    await this.sendEmail(
      {
        template: 'password-changed',
        to: user.email,
        data: { firstName: user.profile?.firstName ?? '' },
      },
      userId,
      meta,
    );
    await this.audit.record({
      actorId: userId,
      action: 'auth.password_reset',
      entityType: 'User',
      entityId: userId,
      meta,
    });
    return this.startSession(userId, { rememberMe: false, meta }, reply);
  }

  async changePassword(principal: Principal, input: ChangeInput, meta: RequestMeta): Promise<void> {
    const user = await this.db.user.findUnique({
      where: { id: principal.userId },
      select: { passwordHash: true, email: true },
    });
    if (!user?.passwordHash || !(await verifyPassword(user.passwordHash, input.currentPassword))) {
      throw Errors.validation([
        { path: 'currentPassword', message: 'Your current password is incorrect.' },
      ]);
    }
    const passwordHash = await hashPassword(input.newPassword);
    await this.db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: principal.userId },
        data: { passwordHash, passwordChangedAt: new Date() },
      });
      await this.sessions.revokeAll(
        principal.userId,
        'password_changed',
        { exceptSessionId: principal.sessionId },
        tx,
      );
    });
    await this.sendEmail(
      { template: 'password-changed', to: user.email, data: { firstName: principal.firstName } },
      principal.userId,
      meta,
    );
    await this.audit.record({
      actorId: principal.userId,
      action: 'auth.password_changed',
      entityType: 'User',
      entityId: principal.userId,
      meta,
    });
  }

  // ---------------------------------------------------------------------------------------
  // Session DTO
  // ---------------------------------------------------------------------------------------

  async sessionUser(principal: Principal): Promise<SessionUser> {
    const profile = await this.db.profile.findUnique({
      where: { userId: principal.userId },
      select: {
        avatarMedia: { select: MEDIA_URL_SELECT },
        homeBranch: { select: { id: true, slug: true, name: true, deletedAt: true } },
      },
    });
    const home = profile?.homeBranch && !profile.homeBranch.deletedAt ? profile.homeBranch : null;
    return {
      id: principal.userId,
      email: principal.email,
      emailVerified: principal.emailVerified,
      firstName: principal.firstName,
      lastName: principal.lastName,
      displayName: principal.displayName,
      avatarUrl: this.mediaUrls.imageUrl(profile?.avatarMedia, 160),
      homeBranch: home ? { id: home.id, slug: home.slug, name: home.name } : null,
      grants: principal.grants.map((g) => ({
        branchId: g.branchId,
        permissions: [...g.permissions],
        rank: g.rank,
        contentTypes: [...(g.contentTypes ?? [])],
      })),
    };
  }

  // ---------------------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------------------

  private async startSession(
    userId: string,
    options: { rememberMe: boolean; meta: RequestMeta },
    reply: FastifyReply,
  ): Promise<SessionUser> {
    const session = await this.sessions.create(userId, options);
    void reply.setCookie(this.config.cookies.sessionName, session.token, {
      path: '/',
      httpOnly: true,
      secure: this.config.cookies.secure,
      sameSite: 'lax',
      // Without "remember me" the cookie lasts for the browser session only.
      ...(session.rememberMe ? { expires: session.absoluteExpiresAt } : {}),
    });
    // Rotate the CSRF token with the session.
    this.csrf.issue(reply);
    const principal = await this.sessions.resolve(session.token);
    if (!principal) throw Errors.unauthenticated();
    return this.sessionUser(principal);
  }

  clearSessionCookie(reply: FastifyReply): void {
    void reply.clearCookie(this.config.cookies.sessionName, { path: '/' });
  }

  private async recordFailedLogin(
    userId: string,
    failures: number,
    meta: RequestMeta,
  ): Promise<void> {
    const lockMinutes =
      failures >= LOGIN_FAILURES_BEFORE_LOCK
        ? Math.min(2 ** (failures - LOGIN_FAILURES_BEFORE_LOCK), MAX_LOCK_MINUTES)
        : 0;
    await this.db.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: failures,
        ...(lockMinutes ? { lockedUntil: new Date(Date.now() + lockMinutes * 60_000) } : {}),
      },
    });
    await this.audit.record({
      actorId: null,
      action: lockMinutes ? 'auth.account_locked' : 'auth.login_failed',
      entityType: 'User',
      entityId: userId,
      summary: lockMinutes
        ? `Locked for ${lockMinutes} minute(s) after ${failures} failed attempts`
        : null,
      meta,
    });
  }

  private async sendVerification(
    userId: string,
    email: string,
    firstName: string,
    meta: RequestMeta,
  ) {
    const { token } = await this.tokens.issue(userId, 'EMAIL_VERIFICATION', email);
    await this.sendEmail(
      {
        template: 'verify-email',
        to: email,
        data: {
          firstName,
          verifyUrl: this.link(`/verify-email?token=${encodeURIComponent(token)}`),
        },
      },
      userId,
      meta,
    );
  }

  private async sendEmail(
    message: EmailMessage,
    userId: string | null,
    meta: RequestMeta,
  ): Promise<void> {
    try {
      await this.jobs.enqueue('sendEmail', { message, userId, requestId: meta.requestId });
    } catch (error) {
      // The request still succeeds; the user can ask for another e-mail.
      this.logger.error({ err: error, template: message.template }, 'Could not enqueue e-mail');
    }
  }

  private link(path: string): string {
    return `${this.config.appOrigin}${path}`;
  }
}

function lockedMessage(): string {
  return 'Too many sign-in attempts. Please wait a few minutes and try again, or reset your password.';
}
