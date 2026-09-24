import { Test, TestingModule } from '@nestjs/testing';
import { BranchesService } from '../../modules/branches/branches.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../modules/admin/audit.service';
import { NotFoundException } from '@nestjs/common';

describe('BranchesService', () => {
  let service: BranchesService;
  let prisma: any;

  const mockBranch = { id: 'branch-1', tenantId: 'tenant-1', name: 'Johannesburg Main', slug: 'johannesburg-main', type: 'MAIN', isActive: true, status: 'PUBLISHED', parentBranchId: null, countryId: 'za-1', createdAt: new Date(), updatedAt: new Date() };

  beforeEach(async () => {
    prisma = {
      branch: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
      branchRecord: { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), count: jest.fn() },
      branchRecordEdit: { create: jest.fn() },
      branchTemporaryServiceTime: { findMany: jest.fn() },
      branchServiceTime: { findMany: jest.fn() },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BranchesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get(BranchesService);
  });

  it('finds branches with pagination', async () => {
    prisma.branch.findMany.mockResolvedValue([mockBranch]);
    prisma.branch.count.mockResolvedValue(1);
    const result = await service.findAll({ tenantId: 'tenant-1', page: 1, limit: 10 });
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
    expect(result.meta.totalPages).toBe(1);
  });

  it('throws NotFoundException for unknown branch', async () => {
    prisma.branch.findUnique.mockResolvedValue(null);
    await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
  });

  it('uses temporary service times when active override exists', async () => {
    const tempTime = { id: 't1', startDate: new Date(Date.now() - 1000), endDate: new Date(Date.now() + 86400000), startTime: '10:00', endTime: '13:00' };
    prisma.branchTemporaryServiceTime.findMany.mockResolvedValue([tempTime]);
    const result = await service.getEffectiveServiceTimes('branch-1');
    expect(result.type).toBe('TEMPORARY');
    expect(result.times).toEqual([tempTime]);
    expect(prisma.branchServiceTime.findMany).not.toHaveBeenCalled();
  });

  it('falls back to standard service times when no override', async () => {
    const stdTime = { id: 's1', dayOfWeek: 0, startTime: '09:00', endTime: '12:00', isActive: true };
    prisma.branchTemporaryServiceTime.findMany.mockResolvedValue([]);
    prisma.branchServiceTime.findMany.mockResolvedValue([stdTime]);
    const result = await service.getEffectiveServiceTimes('branch-1');
    expect(result.type).toBe('STANDARD');
    expect(result.times).toEqual([stdTime]);
  });
});
