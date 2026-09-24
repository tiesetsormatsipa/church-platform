import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { LegacyLink, SitemapResponse } from '@church/shared';
import { ensureDemoData } from '../../test/demo.js';
import { createTestContext, TestClient, type TestContext } from '../../test/harness.js';

let ctx: TestContext;
let client: TestClient;

async function mapLegacy(entityType: string, legacyId: string, newId: string) {
  const key = { source: 'prisma-legacy', entityType, legacyId };
  await ctx.db.legacyIdMap.upsert({
    where: { source_entityType_legacyId: key },
    create: { ...key, newId },
    update: { newId },
  });
}

beforeAll(async () => {
  ctx = await createTestContext();
  await ensureDemoData(ctx.db);
  client = new TestClient(ctx.app);
});
afterAll(async () => {
  await ctx?.close();
});

describe('legacy links', () => {
  it('resolves a legacy branch id to the branch page', async () => {
    const branch = await ctx.db.branch.findFirstOrThrow({
      where: { slug: 'cape-town', organization: { slug: 'test-church' } },
    });
    await mapLegacy('branch', '5c0f9a52-0000-4000-8000-000000000001', branch.id);
    const res = await client.get<LegacyLink>(
      '/api/v1/legacy-links/branch/5c0f9a52-0000-4000-8000-000000000001',
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ path: '/branches/cape-town' });
  });

  it('resolves published content to its canonical path and hides drafts', async () => {
    const org = { organization: { slug: 'test-church' } };
    const published = await ctx.db.contentItem.findFirstOrThrow({
      where: { ...org, slug: 'kimberley-choir-practice-saturdays' },
    });
    const draft = await ctx.db.contentItem.findFirstOrThrow({
      where: { ...org, slug: 'easter-programme-draft' },
    });
    await mapLegacy('content_item', 'legacy-announcement-1', published.id);
    await mapLegacy('content_item', 'legacy-announcement-2', draft.id);

    const ok = await client.get<LegacyLink>('/api/v1/legacy-links/content/legacy-announcement-1');
    expect(ok.status).toBe(200);
    expect(ok.body.path).toBe('/posts/kimberley-choir-practice-saturdays');

    expect((await client.get('/api/v1/legacy-links/content/legacy-announcement-2')).status).toBe(
      404,
    );
    expect((await client.get('/api/v1/legacy-links/content/never-imported')).status).toBe(404);
    expect((await client.get('/api/v1/legacy-links/songs/1')).status).toBe(400);
  });
});

describe('sitemap', () => {
  it('lists public content and branches only', async () => {
    const res = await client.get<SitemapResponse>('/api/v1/sitemap');
    expect(res.status).toBe(200);
    const paths = res.body.content.map((c) => c.path);
    expect(paths).toContain('/events/annual-convention');
    expect(paths.some((p) => p.includes('easter-programme-draft'))).toBe(false);
    expect(paths.some((p) => p.includes('pretoria-prayer-evening'))).toBe(false);
    expect(res.body.branches.map((b) => b.path)).toContain('/branches/johannesburg');
  });
});
