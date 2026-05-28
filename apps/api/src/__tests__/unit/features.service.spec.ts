import { Test, TestingModule } from '@nestjs/testing';
import { FeaturesService } from '../../modules/features/features.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../modules/admin/audit.service';
import { NotFoundException } from '@nestjs/common';

describe('FeaturesService', () => {
  let service: FeaturesService;
  let prisma: any;
  let audit: any;

  const mockFlag = { id: 'flag-1', tenantId: 'tenant-1', key: 'marketplace', module: 'MARKETPLACE' as any, isEnabled: false, rolloutRules: [], description: 'Marketplace', createdAt: new Date(), updatedAt: new Date() };

  beforeEach(async () => {
    prisma = {
      featureFlag: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      featureFlagHistory: { create: jest.fn() },
      rolloutRule: { create: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    audit = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeaturesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<FeaturesService>(FeaturesService);
  });

  describe('isEnabled()', () => {
    it('always returns true for HOME', async () => {
      expect(await service.isEnabled('HOME', 'tenant-1')).toBe(true);
      expect(prisma.featureFlag.findFirst).not.toHaveBeenCalled();
    });
    it('always returns true for PROFILE', async () => {
      expect(await service.isEnabled('PROFILE', 'tenant-1')).toBe(true);
    });
    it('always returns true for REGIONS', async () => {
      expect(await service.isEnabled('REGIONS', 'tenant-1')).toBe(true);
    });
    it('returns false for disabled MARKETPLACE flag', async () => {
      prisma.featureFlag.findFirst.mockResolvedValue(mockFlag);
      expect(await service.isEnabled('marketplace', 'tenant-1')).toBe(false);
    });
    it('returns true for enabled flag', async () => {
      prisma.featureFlag.findFirst.mockResolvedValue({ ...mockFlag, isEnabled: true });
      expect(await service.isEnabled('marketplace', 'tenant-1')).toBe(true);
    });
    it('returns false when flag not found', async () => {
      prisma.featureFlag.findFirst.mockResolvedValue(null);
      expect(await service.isEnabled('marketplace', 'tenant-1')).toBe(false);
    });
  });

  describe('toggle()', () => {
    it('toggles a flag and creates history', async () => {
      prisma.featureFlag.findFirst.mockResolvedValue(mockFlag);
      prisma.featureFlag.update.mockResolvedValue({ ...mockFlag, isEnabled: true });
      prisma.featureFlagHistory.create.mockResolvedValue({});
      audit.log.mockResolvedValue({});
      await service.toggle('marketplace', true, 'user-1', 'Testing', 'tenant-1');
      expect(prisma.featureFlag.update).toHaveBeenCalledWith({ where: { id: 'flag-1' }, data: expect.objectContaining({ isEnabled: true }) });
      expect(prisma.featureFlagHistory.create).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalled();
    });
    it('throws NotFoundException for unknown flag', async () => {
      prisma.featureFlag.findFirst.mockResolvedValue(null);
      await expect(service.toggle('unknown', true, 'user-1')).rejects.toThrow(NotFoundException);
    });
    it('prevents disabling always-on modules', async () => {
      await expect(service.toggle('home', false, 'user-1')).rejects.toThrow('cannot be disabled');
    });
  });

  describe('getNavigationConfig()', () => {
    it('always includes home, profile, regions as true', async () => {
      prisma.featureFlag.findMany.mockResolvedValue([{ ...mockFlag, key: 'messaging', module: 'MESSAGING', isEnabled: false, rolloutRules: [], history: [] }]);
      const config = await service.getNavigationConfig('tenant-1');
      expect(config['home']).toBe(true);
      expect(config['profile']).toBe(true);
      expect(config['regions']).toBe(true);
    });
  });
});
