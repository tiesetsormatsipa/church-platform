import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../admin/audit.service';

@Injectable()
export class GeoService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async getOverview() {
    const [continents, regions, countries] = await Promise.all([
      this.prisma.continent.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.region.findMany({ include: { continent: { select: { id: true, name: true } } }, orderBy: { name: 'asc' } }),
      this.prisma.country.findMany({
        include: { continent: { select: { id: true, name: true } }, region: { select: { id: true, name: true } }, _count: { select: { branches: true } } },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { continents, regions, countries };
  }

  async getContinents() {
    return this.prisma.continent.findMany({ include: { regions: true, _count: { select: { countries: true } } }, orderBy: { name: 'asc' } });
  }

  async getRegions(continentId?: string) {
    return this.prisma.region.findMany({
      where: continentId ? { continentId } : undefined,
      include: { continent: { select: { id: true, name: true } }, _count: { select: { countries: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async getCountries(regionId?: string, continentId?: string) {
    return this.prisma.country.findMany({
      where: { ...(regionId && { regionId }), ...(continentId && { continentId }) },
      include: { continent: true, region: true, _count: { select: { branches: true, provinces: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async getCountryById(id: string) {
    const country = await this.prisma.country.findUnique({
      where: { id },
      include: { continent: true, region: true, provinces: { include: { _count: { select: { branches: true } } } }, branches: { where: { isActive: true }, select: { id: true, name: true, type: true, city: { select: { name: true } } } }, complianceProfile: true },
    });
    if (!country) throw new NotFoundException(`Country ${id} not found.`);
    return country;
  }

  async getProvinces(countryId: string) {
    return this.prisma.province.findMany({ where: { countryId }, include: { _count: { select: { branches: true } } }, orderBy: { name: 'asc' } });
  }

  async updateCountryStatus(countryId: string, status: string, changedBy: string, note?: string) {
    const country = await this.prisma.country.update({ where: { id: countryId }, data: { status: status as any } });
    await this.prisma.geoStatus_Record.create({ data: { entityType: 'Country', entityId: countryId, status: status as any, note, changedBy, changedAt: new Date() } });
    await this.audit.log({ userId: changedBy, action: 'UPDATE', entityType: 'Country', entityId: countryId, newValue: status, reason: note });
    return country;
  }

  async createContinent(data: any, createdBy: string) {
    const c = await this.prisma.continent.create({ data });
    await this.audit.log({ userId: createdBy, action: 'CREATE', entityType: 'Continent', entityId: c.id });
    return c;
  }

  async createRegion(data: any, createdBy: string) {
    const r = await this.prisma.region.create({ data });
    await this.audit.log({ userId: createdBy, action: 'CREATE', entityType: 'Region', entityId: r.id });
    return r;
  }

  async createCountry(data: any, createdBy: string) {
    const c = await this.prisma.country.create({ data });
    await this.audit.log({ userId: createdBy, action: 'CREATE', entityType: 'Country', entityId: c.id });
    return c;
  }

  async getStatusHistory(entityType: string, entityId: string) {
    return this.prisma.geoStatus_Record.findMany({ where: { entityType, entityId }, orderBy: { changedAt: 'desc' } });
  }
}
