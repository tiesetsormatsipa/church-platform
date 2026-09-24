// apps/api/src/modules/admin/audit.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface AuditLogParams {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
  ipAddress?: string;
  metadata?: any;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: AuditLogParams) {
    try {
      return await this.prisma.auditLog.create({
        data: {
          userId:     params.userId,
          action:     params.action as any,
          entityType: params.entityType,
          entityId:   params.entityId,
          fieldName:  params.fieldName,
          oldValue:   params.oldValue,
          newValue:   params.newValue,
          reason:     params.reason,
          ipAddress:  params.ipAddress,
          metadata:   params.metadata,
        },
      });
    } catch (err) {
      // Never let audit logging crash the main operation
      console.error('[AuditService] Failed to write audit log:', err);
    }
  }

  async findAll(params: {
    limit?: number;
    offset?: number;
    entityType?: string;
    userId?: string;
    action?: string;
    tenantId?: string;
  }) {
    const { limit = 50, offset = 0, entityType, userId, action } = params;

    const where: any = {
      ...(entityType && { entityType }),
      ...(userId     && { userId }),
      ...(action     && { action: action as any }),
    };

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            include: {
              profile: { select: { firstName: true, surname: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data: logs, meta: { limit, offset, total } };
  }
}
