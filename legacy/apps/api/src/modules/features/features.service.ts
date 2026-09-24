import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../admin/audit.service';

const ALWAYS_ON = ['home', 'profile', 'regions', 'HOME', 'PROFILE', 'REGIONS'];

@Injectable()
export class FeaturesService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async getAllFlags(tenantId?: string) {
    return this.prisma.featureFlag.findMany({
      where: { OR: [{ tenantId }, { tenantId: null }] },
      include: { rolloutRules: true, history: { orderBy: { changedAt: 'desc' }, take: 3 } },
      orderBy: { module: 'asc' },
    });
  }

  async getFlag(key: string, tenantId?: string) {
    return this.prisma.featureFlag.findFirst({
      where: { key, OR: [{ tenantId }, { tenantId: null }] },
      include: { rolloutRules: { where: { isActive: true } } },
    });
  }

  async isEnabled(key: string, tenantId?: string): Promise<boolean> {
    if (ALWAYS_ON.includes(key)) return true;
    const flag = await this.getFlag(key, tenantId);
    return flag?.isEnabled ?? false;
  }

  async toggle(key: string, enabled: boolean, changedBy: string, reason?: string, tenantId?: string) {
    if (ALWAYS_ON.includes(key) && !enabled) throw new Error(`Module ${key} cannot be disabled.`);
    const flag = await this.prisma.featureFlag.findFirst({ where: { key, OR: [{ tenantId }, { tenantId: null }] } });
    if (!flag) throw new NotFoundException(`Feature flag '${key}' not found.`);

    const updated = await this.prisma.featureFlag.update({ where: { id: flag.id }, data: { isEnabled: enabled } });
    await this.prisma.featureFlagHistory.create({
      data: { featureFlagId: flag.id, changedBy, oldValue: flag.isEnabled, newValue: enabled, reason },
    });
    await this.audit.log({ userId: changedBy, action: 'TOGGLE', entityType: 'FeatureFlag', entityId: flag.id, oldValue: String(flag.isEnabled), newValue: String(enabled), reason });
    return updated;
  }

  async addRolloutRule(flagKey: string, rule: { ruleType: string; ruleValue: string; percentage?: number }, tenantId?: string) {
    const flag = await this.getFlag(flagKey, tenantId);
    if (!flag) throw new NotFoundException(`Feature flag '${flagKey}' not found.`);
    return this.prisma.rolloutRule.create({ data: { featureFlagId: flag.id, ...rule, isActive: true } });
  }

  async getNavigationConfig(tenantId?: string): Promise<Record<string, boolean>> {
    const flags = await this.getAllFlags(tenantId);
    const config: Record<string, boolean> = {};
    for (const flag of flags) {
      config[flag.key] = ALWAYS_ON.includes(flag.key) ? true : flag.isEnabled;
    }
    // Guarantee always-on entries exist
    ['home', 'profile', 'regions'].forEach((k) => { config[k] = true; });
    return config;
  }
}
