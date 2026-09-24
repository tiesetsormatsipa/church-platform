import { Inject, Injectable, Logger } from '@nestjs/common';
import type { DbExecutor, Prisma } from '@church/database';
import type { RequestMeta } from '../../common/principal.js';
import { DATABASE } from '../../infrastructure/tokens.js';

export interface AuditEntry {
  organizationId?: string | null;
  actorId?: string | null;
  /** Dotted verb: "content.publish", "role.assign", "auth.login_failed", … */
  action: string;
  entityType: string;
  entityId?: string | null;
  branchId?: string | null;
  summary?: string | null;
  /** Before/after values of changed fields; sensitive keys are redacted automatically. */
  changes?: Record<string, { from: unknown; to: unknown }> | null;
  meta?: RequestMeta | null;
}

const SENSITIVE = /password|token|secret|hash/i;

/** Compute a redacted field diff for audit logs. */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, to] of Object.entries(after)) {
    if (to === undefined) continue;
    const from = before[key];
    const same = from instanceof Date && to instanceof Date ? from.getTime() === to.getTime() : Object.is(from, to);
    if (same) continue;
    changes[key] = SENSITIVE.test(key) ? { from: '[redacted]', to: '[redacted]' } : { from, to };
  }
  return changes;
}

/** Writes the audit trail. Failures are logged, never propagated to the caller. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@Inject(DATABASE) private readonly db: DbExecutor) {}

  async record(entry: AuditEntry, executor: DbExecutor = this.db): Promise<void> {
    try {
      await executor.auditLog.create({
        data: {
          organizationId: entry.organizationId ?? null,
          actorId: entry.actorId ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          branchId: entry.branchId ?? null,
          summary: entry.summary?.slice(0, 500) ?? null,
          changes: (entry.changes ?? undefined) as Prisma.InputJsonValue | undefined,
          ipAddress: entry.meta?.ip ?? null,
          userAgent: entry.meta?.userAgent ?? null,
          requestId: entry.meta?.requestId ?? null,
        },
      });
    } catch (error) {
      this.logger.error({ err: error, action: entry.action }, 'Failed to write audit log');
    }
  }
}
