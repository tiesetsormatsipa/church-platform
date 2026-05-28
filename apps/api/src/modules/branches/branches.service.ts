import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../admin/audit.service';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async findAll(filters: { tenantId?: string; countryId?: string; type?: string; search?: string; page?: number; limit?: number }) {
    const { page = 1, limit = 20, search, type, countryId, tenantId } = filters;
    const where: any = {
      isActive: true,
      ...(tenantId && { tenantId }),
      ...(type && { type }),
      ...(countryId && { countryId }),
      ...(search && { OR: [{ name: { contains: search, mode: 'insensitive' } }, { city: { name: { contains: search, mode: 'insensitive' } } }] }),
    };
    const [branches, total] = await Promise.all([
      this.prisma.branch.findMany({
        where, skip: (page - 1) * limit, take: limit,
        include: {
          country: true, province: true, city: true,
          parentBranch: { select: { id: true, name: true } },
          subBranches: { select: { id: true, name: true, type: true } },
          leadership: { where: { isActive: true }, orderBy: { order: 'asc' } },
          serviceTimes: { where: { isActive: true } },
          _count: { select: { profiles: true } },
        },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.branch.count({ where }),
    ]);
    return { data: branches, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        country: true, province: true, city: true,
        parentBranch: { select: { id: true, name: true } },
        subBranches: { include: { leadership: { where: { isActive: true } }, serviceTimes: { where: { isActive: true } } } },
        leadership: { where: { isActive: true }, orderBy: { order: 'asc' } },
        serviceTimes: { where: { isActive: true } },
        tempServiceTimes: { where: { endDate: { gte: new Date() } }, orderBy: { startDate: 'asc' } },
        prayerSchedules: { where: { isActive: true } },
        fastingSchedules: { where: { isActive: true } },
        announcements: { where: { status: 'PUBLISHED' }, orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }], take: 10 },
        media: { include: { mediaAsset: true }, orderBy: { order: 'asc' } },
        _count: { select: { profiles: true, records: true } },
      },
    });
    if (!branch) throw new NotFoundException(`Branch ${id} not found`);
    return branch;
  }

  async create(data: any, createdBy: string) {
    const branch = await this.prisma.branch.create({ data: { ...data, createdBy } });
    await this.audit.log({ userId: createdBy, action: 'CREATE', entityType: 'Branch', entityId: branch.id });
    return branch;
  }

  async update(id: string, data: any, updatedBy: string) {
    const existing = await this.prisma.branch.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Branch ${id} not found`);
    const updated = await this.prisma.branch.update({ where: { id }, data });
    await this.audit.log({ userId: updatedBy, action: 'UPDATE', entityType: 'Branch', entityId: id });
    return updated;
  }

  async getRecords(branchId: string, filters: { page?: number; limit?: number; from?: Date; to?: Date }) {
    const { page = 1, limit = 50, from, to } = filters;
    return this.prisma.branchRecord.findMany({
      where: { branchId, ...(from && to && { date: { gte: from, lte: to } }) },
      include: { editHistory: { orderBy: { changedAt: 'desc' }, take: 5 } },
      orderBy: { date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async createRecord(branchId: string, data: any, createdBy: string) {
    const record = await this.prisma.branchRecord.create({ data: { ...data, branchId, createdBy } });
    await this.audit.log({ userId: createdBy, action: 'CREATE', entityType: 'BranchRecord', entityId: record.id });
    return record;
  }

  async updateRecord(id: string, data: any, changedBy: string, reason?: string) {
    const existing = await this.prisma.branchRecord.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Record ${id} not found`);
    const editHistory: any[] = [];
    for (const [field, newValue] of Object.entries(data)) {
      const oldValue = (existing as any)[field];
      if (String(oldValue) !== String(newValue)) {
        editHistory.push({ recordId: id, changedBy, fieldName: field, oldValue: String(oldValue ?? ''), newValue: String(newValue ?? ''), reason });
      }
    }
    const [updated] = await this.prisma.$transaction([
      this.prisma.branchRecord.update({ where: { id }, data }),
      ...editHistory.map((e) => this.prisma.branchRecordEdit.create({ data: e })),
    ]);
    return updated;
  }

  async getEffectiveServiceTimes(branchId: string, date: Date = new Date()) {
    const tempOverrides = await this.prisma.branchTemporaryServiceTime.findMany({
      where: { branchId, startDate: { lte: date }, endDate: { gte: date } },
    });
    if (tempOverrides.length > 0) return { type: 'TEMPORARY', times: tempOverrides };
    const standard = await this.prisma.branchServiceTime.findMany({ where: { branchId, isActive: true }, orderBy: { dayOfWeek: 'asc' } });
    return { type: 'STANDARD', times: standard };
  }
}
