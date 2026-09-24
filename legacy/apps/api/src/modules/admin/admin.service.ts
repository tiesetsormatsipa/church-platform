import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getPlatformStats(tenantId?: string) {
    const [totalMembers, verifiedMembers, pendingVerifications, branches, pendingProducts, pendingJobs, pendingSongs, openCases, orders, jobs, songs] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { verificationStatus: 'VERIFIED', deletedAt: null } }),
      this.prisma.verificationRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.branch.count({ where: { isActive: true, ...(tenantId && { tenantId }) } }),
      this.prisma.product.count({ where: { status: 'PENDING_REVIEW' } }),
      this.prisma.jobPost.count({ where: { status: 'PENDING_REVIEW' } }),
      this.prisma.song.count({ where: { status: 'PENDING_REVIEW' } }),
      this.prisma.moderationCase.count({ where: { status: 'OPEN' } }),
      this.prisma.order.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
      this.prisma.jobPost.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.song.count({ where: { status: 'PUBLISHED' } }),
    ]);
    return { totalMembers, verifiedMembers, pendingVerifications, pendingReview: pendingVerifications + pendingProducts + pendingJobs + pendingSongs, branches, pendingProducts, pendingJobs, pendingSongs, openCases, orders, jobs, songs };
  }

  async getBrandSettings(tenantId: string) {
    return this.prisma.brandSettings.findUnique({ where: { tenantId } });
  }

  async updateBrandSettings(tenantId: string, data: any) {
    const existing = await this.prisma.brandSettings.findUnique({ where: { tenantId } });
    if (existing) return this.prisma.brandSettings.update({ where: { tenantId }, data });
    return this.prisma.brandSettings.create({ data: { ...data, tenantId } });
  }

  async getModerationCases(status?: string) {
    return this.prisma.moderationCase.findMany({
      where: { ...(status && { status }) },
      include: { subject: { include: { profile: { select: { firstName: true, surname: true } } } }, actions: { orderBy: { createdAt: 'desc' }, take: 3 } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async openModerationCase(subjectId: string, reason: string, reporterId: string, description?: string) {
    return this.prisma.moderationCase.create({ data: { subjectId, reason, description, reviewerId: reporterId, status: 'OPEN' } });
  }

  async takeModerationAction(caseId: string, action: string, performedBy: string, reason?: string, expiresAt?: Date) {
    const mcase = await this.prisma.moderationCase.update({
      where: { id: caseId },
      data: { status: action === 'CASE_CLOSED' ? 'CLOSED' : 'OPEN', resolvedAt: action === 'CASE_CLOSED' ? new Date() : undefined },
    });
    await this.prisma.moderationCaseAction.create({ data: { caseId, action: action as any, performedBy, reason, expiresAt } });
    if (['ACCOUNT_SUSPENDED', 'ACCOUNT_BANNED'].includes(action)) {
      await this.prisma.user.update({ where: { id: mcase.subjectId }, data: { status: action === 'ACCOUNT_BANNED' ? 'BANNED' : 'SUSPENDED' } });
    }
    return mcase;
  }

  async getAuditLogs(filters: { limit?: number; offset?: number; entityType?: string; userId?: string; action?: string }) {
    const { limit = 50, offset = 0, entityType, userId, action } = filters;
    const where: any = { ...(entityType && { entityType }), ...(userId && { userId }), ...(action && { action: action as any }) };
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, include: { user: { include: { profile: { select: { firstName: true, surname: true } } } } }, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data: logs, meta: { limit, offset, total } };
  }
}
