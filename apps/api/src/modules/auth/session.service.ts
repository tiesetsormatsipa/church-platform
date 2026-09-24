import { Inject, Injectable, Logger } from '@nestjs/common';
import type { DatabaseClient, DbExecutor } from '@church/database';
import { randomToken, sha256Hex } from '@church/infrastructure/tokens';
import { type Grant, isPermission } from '@church/shared';
import { APP_CONFIG, type AppConfig } from '../../config/env.js';
import type { Principal, RequestMeta } from '../../common/principal.js';
import { DATABASE } from '../../infrastructure/tokens.js';
import { OrganizationService } from '../core/organization.service.js';

export interface CreatedSession {
  id: string;
  token: string;
  rememberMe: boolean;
  absoluteExpiresAt: Date;
}

/**
 * Server-side sessions (ADR-008). The cookie holds a random token; only its SHA-256 is
 * stored, so a database leak does not expose usable sessions.
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly organizations: OrganizationService,
  ) {}

  async create(
    userId: string,
    options: { rememberMe: boolean; meta: RequestMeta },
    executor: DbExecutor = this.db,
  ): Promise<CreatedSession> {
    const token = randomToken(32);
    const now = Date.now();
    const absoluteTtl = options.rememberMe ? this.config.session.rememberMeTtlMs : this.config.session.shortTtlMs;
    const absoluteExpiresAt = new Date(now + absoluteTtl);
    const idleExpiresAt = new Date(Math.min(now + this.config.session.idleTtlMs, absoluteExpiresAt.getTime()));
    const session = await executor.session.create({
      data: {
        userId,
        tokenHash: sha256Hex(token),
        rememberMe: options.rememberMe,
        ipAddress: options.meta.ip,
        userAgent: options.meta.userAgent,
        idleExpiresAt,
        absoluteExpiresAt,
      },
      select: { id: true },
    });
    return { id: session.id, token, rememberMe: options.rememberMe, absoluteExpiresAt };
  }

  /** Validate a cookie token and build the principal; null if invalid, expired or revoked. */
  async resolve(token: string): Promise<Principal | null> {
    if (!token || token.length > 128) return null;
    const organizationId = await this.organizations.currentId();
    const now = new Date();
    const session = await this.db.session.findUnique({
      where: { tokenHash: sha256Hex(token) },
      select: {
        id: true,
        revokedAt: true,
        idleExpiresAt: true,
        absoluteExpiresAt: true,
        lastSeenAt: true,
        user: {
          select: {
            id: true,
            email: true,
            emailVerifiedAt: true,
            status: true,
            deletedAt: true,
            profile: {
              select: { firstName: true, lastName: true, displayName: true, avatarMediaId: true, homeBranchId: true },
            },
            roleAssignments: {
              where: { organizationId, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
              select: { branchId: true, role: { select: { permissions: { select: { permission: true } } } } },
            },
          },
        },
      },
    });
    if (!session) return null;
    if (session.revokedAt || session.idleExpiresAt <= now || session.absoluteExpiresAt <= now) return null;
    const { user } = session;
    if (user.status !== 'ACTIVE' || user.deletedAt) return null;

    if (now.getTime() - session.lastSeenAt.getTime() > this.config.session.touchIntervalMs) {
      const idleExpiresAt = new Date(
        Math.min(now.getTime() + this.config.session.idleTtlMs, session.absoluteExpiresAt.getTime()),
      );
      await this.db.session
        .update({ where: { id: session.id }, data: { lastSeenAt: now, idleExpiresAt } })
        .catch((error: unknown) => this.logger.warn({ err: error }, 'Could not touch session'));
    }

    const grants: Grant[] = user.roleAssignments.map((assignment) => ({
      branchId: assignment.branchId,
      permissions: assignment.role.permissions.map((p) => p.permission).filter(isPermission),
    }));
    const firstName = user.profile?.firstName ?? '';
    const lastName = user.profile?.lastName ?? '';
    return {
      userId: user.id,
      sessionId: session.id,
      email: user.email,
      emailVerified: user.emailVerifiedAt !== null,
      firstName,
      lastName,
      displayName: user.profile?.displayName || `${firstName} ${lastName}`.trim() || user.email,
      avatarMediaId: user.profile?.avatarMediaId ?? null,
      homeBranchId: user.profile?.homeBranchId ?? null,
      grants,
    };
  }

  async revoke(sessionId: string, reason: string, executor: DbExecutor = this.db): Promise<void> {
    await executor.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  /** Revoke every active session of a user, optionally keeping one (the current device). */
  async revokeAll(
    userId: string,
    reason: string,
    options: { exceptSessionId?: string } = {},
    executor: DbExecutor = this.db,
  ): Promise<number> {
    const result = await executor.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(options.exceptSessionId ? { id: { not: options.exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    return result.count;
  }

  async listActive(userId: string) {
    const now = new Date();
    return this.db.session.findMany({
      where: { userId, revokedAt: null, idleExpiresAt: { gt: now }, absoluteExpiresAt: { gt: now } },
      orderBy: { lastSeenAt: 'desc' },
      select: { id: true, userAgent: true, ipAddress: true, createdAt: true, lastSeenAt: true },
      take: 50,
    });
  }
}
