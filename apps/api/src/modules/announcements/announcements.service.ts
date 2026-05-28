import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../admin/audit.service';

@Injectable()
export class AnnouncementsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async findAll(filters: { category?: string; branchId?: string; status?: string; page?: number; limit?: number; tenantId?: string }) {
    const { category, branchId, status = 'PUBLISHED', page = 1, limit = 20, tenantId } = filters;
    const where: any = {
      status: status as any,
      ...(tenantId && { tenantId }),
      ...(category && { category }),
    };
    const [announcements, total] = await Promise.all([
      this.prisma.announcement.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.announcement.count({ where }),
    ]);
    return { data: announcements, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async create(data: any, createdBy: string) {
    const ann = await this.prisma.announcement.create({ data: { ...data, createdBy } });
    await this.audit.log({ userId: createdBy, action: 'CREATE', entityType: 'Announcement', entityId: ann.id });
    return ann;
  }

  async update(id: string, data: any, updatedBy: string) {
    const ann = await this.prisma.announcement.update({ where: { id }, data });
    await this.audit.log({ userId: updatedBy, action: 'UPDATE', entityType: 'Announcement', entityId: id });
    return ann;
  }

  async publish(id: string, publishedBy: string) {
    const ann = await this.prisma.announcement.update({ where: { id }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
    await this.audit.log({ userId: publishedBy, action: 'PUBLISH', entityType: 'Announcement', entityId: id });
    return ann;
  }

  async delete(id: string, deletedBy: string) {
    await this.prisma.announcement.update({ where: { id }, data: { status: 'ARCHIVED' } });
    await this.audit.log({ userId: deletedBy, action: 'ARCHIVE', entityType: 'Announcement', entityId: id });
    return { success: true };
  }

  async getCountdownConfig(tenantId: string) {
    return this.prisma.eventCountdownConfig.findFirst({ where: { tenantId, isActive: true }, orderBy: { createdAt: 'desc' } });
  }

  async updateCountdownConfig(tenantId: string, data: any, updatedBy: string) {
    const existing = await this.prisma.eventCountdownConfig.findFirst({ where: { tenantId, isActive: true } });
    const config = existing
      ? await this.prisma.eventCountdownConfig.update({ where: { id: existing.id }, data })
      : await this.prisma.eventCountdownConfig.create({ data: { ...data, tenantId, createdBy: updatedBy } });
    await this.audit.log({ userId: updatedBy, action: 'UPDATE', entityType: 'EventCountdownConfig', entityId: config.id });
    return config;
  }
}
