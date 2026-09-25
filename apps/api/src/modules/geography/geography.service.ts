import { Inject, Injectable } from '@nestjs/common';
import type { DatabaseClient, Prisma } from '@church/database';
import {
  countryHue,
  countryInfo,
  type BaptismSummary,
  type GeoBranch,
  type GeographyOverview,
} from '@church/shared';
import { DATABASE } from '../../infrastructure/tokens.js';
import { OrganizationService } from '../core/organization.service.js';

const GEO_SELECT = {
  id: true,
  slug: true,
  name: true,
  type: true,
  status: true,
  countryCode: true,
  city: true,
  latitude: true,
  longitude: true,
  parentBranchId: true,
} as const satisfies Prisma.BranchSelect;

type GeoRow = Prisma.BranchGetPayload<{ select: typeof GEO_SELECT }>;

/**
 * The church's geography and its baptism numbers.
 *
 * Branches form one tree of arbitrary depth and a branch's parent may sit in another country
 * (ROADMAP_V2 §1), so two different totals are meaningful and both are returned: `own` counts
 * a branch's own baptisms, `total` counts everything beneath it as well. Country totals group
 * by the branch's own country, which is deliberately *not* the same as walking the tree.
 */
@Injectable()
export class GeographyService {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly organizations: OrganizationService,
  ) {}

  /** Everything the globe needs: countries, branches, and the totals on each. */
  async overview(): Promise<GeographyOverview> {
    const organization = await this.organizations.current();
    const where: Prisma.BranchWhereInput = {
      organizationId: organization.id,
      deletedAt: null,
      status: 'ACTIVE',
    };

    const [rows, memberCounts, baptismCounts] = await Promise.all([
      this.db.branch.findMany({ where, select: GEO_SELECT, orderBy: { sortOrder: 'asc' } }),
      this.db.branchMembership.groupBy({
        by: ['branchId'],
        where: { status: 'ACTIVE', branch: where },
        _count: { _all: true },
      }),
      this.db.branchBaptismRecord.groupBy({
        by: ['branchId'],
        where: { deletedAt: null, branch: where },
        _sum: { count: true },
      }),
    ]);

    const members = new Map<string, number>(memberCounts.map((m) => [m.branchId, m._count._all]));
    const ownBaptisms = new Map<string, number>(
      baptismCounts.map((b) => [b.branchId, b._sum.count ?? 0]),
    );

    const childrenOf = new Map<string | null, GeoRow[]>();
    for (const row of rows) {
      const siblings = childrenOf.get(row.parentBranchId) ?? [];
      siblings.push(row);
      childrenOf.set(row.parentBranchId, siblings);
    }

    const depths = computeDepths(rows, childrenOf);
    const subtreeBaptisms = computeSubtreeTotals(rows, childrenOf, ownBaptisms);

    const branches: GeoBranch[] = rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      type: row.type,
      status: row.status,
      countryCode: row.countryCode.toUpperCase(),
      city: row.city,
      latitude: row.latitude === null ? null : Number(row.latitude),
      longitude: row.longitude === null ? null : Number(row.longitude),
      parentBranchId: row.parentBranchId,
      depth: depths.get(row.id) ?? 0,
      members: members.get(row.id) ?? 0,
      baptisms: {
        own: ownBaptisms.get(row.id) ?? 0,
        total: subtreeBaptisms.get(row.id) ?? 0,
      },
    }));

    const byCountry = new Map<string, GeoBranch[]>();
    for (const branch of branches) {
      const group = byCountry.get(branch.countryCode) ?? [];
      group.push(branch);
      byCountry.set(branch.countryCode, group);
    }

    const countries = [...byCountry.entries()]
      .map(([code, group]) => {
        const info = countryInfo(code);
        // A country's branches may carry no coordinates yet; fall back to the country point.
        const located = group.filter((b) => b.latitude !== null && b.longitude !== null);
        const latitude = located.length
          ? located.reduce((sum, b) => sum + (b.latitude ?? 0), 0) / located.length
          : info.latitude;
        const longitude = located.length
          ? located.reduce((sum, b) => sum + (b.longitude ?? 0), 0) / located.length
          : info.longitude;
        return {
          code,
          name: info.name,
          latitude,
          longitude,
          hue: countryHue(code),
          branchCount: group.length,
          mainBranchCount: group.filter((b) => b.type === 'MAIN').length,
          members: group.reduce((sum, b) => sum + b.members, 0),
          // Own totals only: summing subtree totals would count a branch more than once.
          baptisms: group.reduce((sum, b) => sum + b.baptisms.own, 0),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      countries,
      branches,
      totals: {
        countries: countries.length,
        branches: branches.length,
        members: branches.reduce((sum, b) => sum + b.members, 0),
        baptisms: branches.reduce((sum, b) => sum + b.baptisms.own, 0),
      },
    };
  }

  /** Baptism totals for the home page: all time, a chosen year, by country and by year. */
  async baptismSummary(year?: number): Promise<BaptismSummary> {
    const organization = await this.organizations.current();
    const branchWhere: Prisma.BranchWhereInput = {
      organizationId: organization.id,
      deletedAt: null,
      status: 'ACTIVE',
    };
    const selectedYear = year ?? new Date().getUTCFullYear();

    const [branches, perBranch, perYear] = await Promise.all([
      this.db.branch.findMany({ where: branchWhere, select: { id: true, countryCode: true } }),
      this.db.branchBaptismRecord.groupBy({
        by: ['branchId'],
        where: { deletedAt: null, branch: branchWhere },
        _sum: { count: true },
      }),
      // One grouped read rather than a query per year; the table is small and append-only.
      this.db.branchBaptismRecord.findMany({
        where: { deletedAt: null, branch: branchWhere },
        select: { branchId: true, occurredOn: true, count: true },
      }),
    ]);

    const countryOf = new Map<string, string>(
      branches.map((b) => [b.id, b.countryCode.toUpperCase()]),
    );
    const allTimeByBranch = new Map<string, number>(
      perBranch.map((b) => [b.branchId, b._sum.count ?? 0]),
    );

    const yearTotals = new Map<number, number>();
    const yearByCountry = new Map<string, number>();
    for (const record of perYear) {
      const recordYear = record.occurredOn.getUTCFullYear();
      yearTotals.set(recordYear, (yearTotals.get(recordYear) ?? 0) + record.count);
      if (recordYear === selectedYear) {
        const code = countryOf.get(record.branchId) ?? 'ZZ';
        yearByCountry.set(code, (yearByCountry.get(code) ?? 0) + record.count);
      }
    }

    const allTimeByCountry = new Map<string, number>();
    for (const [branchId, total] of allTimeByBranch) {
      const code = countryOf.get(branchId) ?? 'ZZ';
      allTimeByCountry.set(code, (allTimeByCountry.get(code) ?? 0) + total);
    }

    const countries = [...allTimeByCountry.entries()]
      .map(([code, allTime]) => ({
        code,
        name: countryInfo(code).name,
        hue: countryHue(code),
        allTime,
        yearTotal: yearByCountry.get(code) ?? 0,
      }))
      .sort((a, b) => b.allTime - a.allTime || a.name.localeCompare(b.name));

    return {
      allTime: [...allTimeByBranch.values()].reduce((sum: number, n: number) => sum + n, 0),
      year: selectedYear,
      yearTotal: yearTotals.get(selectedYear) ?? 0,
      countries,
      years: [...yearTotals.entries()]
        .map(([y, total]) => ({ year: y, total }))
        .sort((a, b) => b.year - a.year),
    };
  }
}

/** Depth of each branch in the tree, iteratively so a deep tree cannot blow the stack. */
function computeDepths(rows: GeoRow[], childrenOf: Map<string | null, GeoRow[]>) {
  const depths = new Map<string, number>();
  const known = new Set(rows.map((r) => r.id));
  // A branch whose parent is missing or outside this set is a root for our purposes.
  const roots = rows.filter((r) => !r.parentBranchId || !known.has(r.parentBranchId));
  const queue: { row: GeoRow; depth: number }[] = roots.map((row) => ({ row, depth: 0 }));
  while (queue.length > 0) {
    const { row, depth } = queue.shift()!;
    if (depths.has(row.id)) continue; // a cycle, or a branch reached twice
    depths.set(row.id, depth);
    for (const child of childrenOf.get(row.id) ?? []) {
      queue.push({ row: child, depth: depth + 1 });
    }
  }
  // Anything left is part of a cycle; give it a depth rather than dropping it.
  for (const row of rows) if (!depths.has(row.id)) depths.set(row.id, 0);
  return depths;
}

/** Each branch's own total plus every descendant's, computed deepest-first. */
function computeSubtreeTotals(
  rows: GeoRow[],
  childrenOf: Map<string | null, GeoRow[]>,
  own: Map<string, number>,
) {
  const totals = new Map<string, number>();
  const visiting = new Set<string>();

  const visit = (row: GeoRow): number => {
    const cached = totals.get(row.id);
    if (cached !== undefined) return cached;
    if (visiting.has(row.id)) return own.get(row.id) ?? 0; // cycle guard
    visiting.add(row.id);
    let total = own.get(row.id) ?? 0;
    for (const child of childrenOf.get(row.id) ?? []) total += visit(child);
    visiting.delete(row.id);
    totals.set(row.id, total);
    return total;
  };

  for (const row of rows) visit(row);
  return totals;
}
