import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BaptismSummary, GeographyOverview } from '@church/shared';
import { createTestContext, TestClient, type TestContext } from '../../test/harness.js';

let ctx: TestContext;
let organizationId: string;

/** The shape the owner described: two main branches, with Namibia sitting under one of them. */
const ids: Record<string, string> = {};

beforeAll(async () => {
  ctx = await createTestContext();
  const organization = await ctx.db.organization.findFirstOrThrow({ select: { id: true } });
  organizationId = organization.id;

  const make = async (
    slug: string,
    name: string,
    type: 'MAIN' | 'SUB',
    countryCode: string,
    parent: string | null,
    latitude: number,
    longitude: number,
  ) => {
    const branch = await ctx.db.branch.create({
      data: {
        organizationId,
        slug,
        name,
        type,
        countryCode,
        status: 'ACTIVE',
        latitude,
        longitude,
        parentBranchId: parent ? ids[parent] : null,
      },
      select: { id: true },
    });
    ids[slug] = branch.id;
  };

  const tag = Date.now().toString(36);
  await make(`geo-jhb-${tag}`, 'Geo Johannesburg', 'MAIN', 'ZA', null, -26.2, 28.05);
  await make(`geo-cpt-${tag}`, 'Geo Cape Town', 'MAIN', 'ZA', null, -33.92, 18.42);
  await make(`geo-pta-${tag}`, 'Geo Pretoria', 'SUB', 'ZA', `geo-jhb-${tag}`, -25.74, 28.18);
  // A Namibian branch under a South African parent: the case a fixed country level cannot hold.
  await make(`geo-wdh-${tag}`, 'Geo Windhoek', 'SUB', 'NA', `geo-jhb-${tag}`, -22.55, 17.08);
  await make(`geo-kim-${tag}`, 'Geo Kimberley', 'SUB', 'ZA', `geo-cpt-${tag}`, -28.72, 24.74);

  const on = (year: number, month: number, day: number) => new Date(Date.UTC(year, month, day));
  await ctx.db.branchBaptismRecord.createMany({
    data: [
      { branchId: ids[`geo-jhb-${tag}`]!, occurredOn: on(2026, 0, 11), count: 10 },
      { branchId: ids[`geo-jhb-${tag}`]!, occurredOn: on(2025, 5, 8), count: 5 },
      { branchId: ids[`geo-pta-${tag}`]!, occurredOn: on(2026, 1, 1), count: 3 },
      { branchId: ids[`geo-wdh-${tag}`]!, occurredOn: on(2026, 2, 15), count: 4 },
      { branchId: ids[`geo-cpt-${tag}`]!, occurredOn: on(2026, 3, 5), count: 7 },
      { branchId: ids[`geo-kim-${tag}`]!, occurredOn: on(2025, 8, 21), count: 2 },
    ],
  });
});

afterAll(async () => {
  await ctx?.close();
});

/** The overview covers every branch in the organisation; pick out the ones this file made. */
async function overview() {
  const client = new TestClient(ctx.app);
  const response = await client.get<GeographyOverview>('/api/v1/geography');
  expect(response.status).toBe(200);
  const bySlugPrefix = (prefix: string) =>
    response.body.branches.find((b) => b.slug.startsWith(prefix));
  return { body: response.body, find: bySlugPrefix };
}

describe('GET /api/v1/geography', () => {
  it('is public', async () => {
    const response = await new TestClient(ctx.app).get('/api/v1/geography');
    expect(response.status).toBe(200);
  });

  it('places a branch at its depth in the tree', async () => {
    const { find } = await overview();
    expect(find('geo-jhb-')?.depth).toBe(0);
    expect(find('geo-pta-')?.depth).toBe(1);
    expect(find('geo-wdh-')?.depth).toBe(1);
  });

  it("adds a branch's descendants into its total but not into its own count", async () => {
    const { find } = await overview();
    const johannesburg = find('geo-jhb-');
    // 15 of its own, plus Pretoria's 3 and Windhoek's 4.
    expect(johannesburg?.baptisms.own).toBe(15);
    expect(johannesburg?.baptisms.total).toBe(22);

    const capeTown = find('geo-cpt-');
    expect(capeTown?.baptisms.own).toBe(7);
    expect(capeTown?.baptisms.total).toBe(9);
  });

  it('counts a leaf branch as its own subtree', async () => {
    const { find } = await overview();
    const windhoek = find('geo-wdh-');
    expect(windhoek?.baptisms.own).toBe(4);
    expect(windhoek?.baptisms.total).toBe(4);
  });

  it('groups a branch under its own country even when its parent is elsewhere', async () => {
    const { body } = await overview();
    const namibia = body.countries.find((c) => c.code === 'NA');
    expect(namibia).toBeDefined();
    expect(namibia?.name).toBe('Namibia');
    // Windhoek's baptisms count towards Namibia, though it hangs under a South African branch.
    expect(namibia?.baptisms).toBeGreaterThanOrEqual(4);
    expect(namibia?.mainBranchCount).toBe(0);
  });

  it('gives each country a stable colour and a place to fly to', async () => {
    const { body } = await overview();
    for (const country of body.countries) {
      expect(country.hue).toBeGreaterThanOrEqual(0);
      expect(country.hue).toBeLessThan(360);
      expect(Number.isFinite(country.latitude)).toBe(true);
      expect(Number.isFinite(country.longitude)).toBe(true);
    }
    const hues = body.countries.map((c) => c.hue);
    expect(new Set(hues).size).toBe(hues.length);
  });

  it('never counts a branch twice in the church-wide total', async () => {
    const { body } = await overview();
    const sumOfOwn = body.branches.reduce((sum, b) => sum + b.baptisms.own, 0);
    const sumOfCountries = body.countries.reduce((sum, c) => sum + c.baptisms, 0);
    expect(body.totals.baptisms).toBe(sumOfOwn);
    expect(sumOfCountries).toBe(sumOfOwn);
  });
});

describe('GET /api/v1/geography/baptisms', () => {
  it('reports the all-time total and a breakdown by country', async () => {
    const client = new TestClient(ctx.app);
    const response = await client.get<BaptismSummary>('/api/v1/geography/baptisms?year=2026');
    expect(response.status).toBe(200);
    expect(response.body.year).toBe(2026);
    expect(response.body.allTime).toBeGreaterThanOrEqual(31);

    const namibia = response.body.countries.find((c) => c.code === 'NA');
    expect(namibia?.allTime).toBeGreaterThanOrEqual(4);
    expect(namibia?.yearTotal).toBeGreaterThanOrEqual(4);
  });

  it('counts only the chosen year in the year total', async () => {
    const client = new TestClient(ctx.app);
    const [all, y2025, y2026] = await Promise.all([
      client.get<BaptismSummary>('/api/v1/geography/baptisms'),
      client.get<BaptismSummary>('/api/v1/geography/baptisms?year=2025'),
      client.get<BaptismSummary>('/api/v1/geography/baptisms?year=2026'),
    ]);
    // The two years this file seeded must both appear and must not overlap.
    expect(y2025.body.yearTotal).toBeGreaterThanOrEqual(7);
    expect(y2026.body.yearTotal).toBeGreaterThanOrEqual(24);
    expect(y2025.body.allTime).toBe(y2026.body.allTime);
    expect(all.body.allTime).toBe(y2026.body.allTime);
  });

  it('lists a total for every year that has entries, newest first', async () => {
    const client = new TestClient(ctx.app);
    const response = await client.get<BaptismSummary>('/api/v1/geography/baptisms');
    const years = response.body.years.map((y) => y.year);
    expect(years).toContain(2025);
    expect(years).toContain(2026);
    expect([...years]).toEqual([...years].sort((a, b) => b - a));
  });

  it('rejects a year that is not a year', async () => {
    const client = new TestClient(ctx.app);
    const response = await client.get('/api/v1/geography/baptisms?year=notayear');
    expect(response.status).toBe(400);
  });
});
