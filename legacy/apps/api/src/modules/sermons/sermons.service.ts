import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../admin/audit.service';

@Injectable()
export class SermonsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async findAll(filters: { search?: string; tab?: string; minister?: string; branchId?: string; countryId?: string; language?: string; from?: Date; to?: Date; page?: number; limit?: number; status?: string; tenantId?: string }) {
    const { search, tab, minister, branchId, countryId, language, from, to, page = 1, limit = 20, status = 'PUBLISHED', tenantId } = filters;
    const where: any = {
      status: status as any,
      ...(tenantId && { tenantId }),
      ...(tab && { tab }),
      ...(minister && { minister: { contains: minister, mode: 'insensitive' } }),
      ...(branchId && { branchId }),
      ...(countryId && { countryId }),
      ...(language && { language }),
      ...(from && to && { date: { gte: from, lte: to } }),
      ...(search && { OR: [{ title: { contains: search, mode: 'insensitive' } }, { minister: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }] }),
    };
    const [sermons, total] = await Promise.all([
      this.prisma.sermon.findMany({
        where,
        include: { audioAsset: { select: { id: true, url: true, durationSeconds: true, storedKey: true } }, uploader: { include: { profile: { select: { firstName: true, surname: true } } } } },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.sermon.count({ where }),
    ]);
    return { data: sermons, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const sermon = await this.prisma.sermon.findUnique({ where: { id }, include: { audioAsset: true } });
    if (!sermon) throw new NotFoundException('Sermon not found.');
    await this.prisma.sermon.update({ where: { id }, data: { views: { increment: 1 } } });
    return sermon;
  }

  async create(data: any, uploaderId: string) {
    const sermon = await this.prisma.sermon.create({ data: { ...data, uploaderId, status: 'DRAFT', keywords: data.keywords || [] } });
    await this.audit.log({ userId: uploaderId, action: 'CREATE', entityType: 'Sermon', entityId: sermon.id });
    return sermon;
  }

  async publish(id: string, publishedBy: string) {
    const sermon = await this.prisma.sermon.update({ where: { id }, data: { status: 'PUBLISHED' } });
    await this.audit.log({ userId: publishedBy, action: 'PUBLISH', entityType: 'Sermon', entityId: id });
    return sermon;
  }
}
