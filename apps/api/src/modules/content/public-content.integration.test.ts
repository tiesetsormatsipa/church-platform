import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BranchDetail, ContentPage, HomeResponse, SearchResponse } from '@church/shared';
import { ensureDemoData } from '../../test/demo.js';
import {
  createTestContext,
  queuedEmails,
  TestClient,
  type TestContext,
} from '../../test/harness.js';

let ctx: TestContext;
let client: TestClient;

beforeAll(async () => {
  ctx = await createTestContext();
  await ensureDemoData(ctx.db);
  client = new TestClient(ctx.app);
});
afterAll(async () => {
  await ctx?.close();
});

const titles = (page: ContentPage) => page.items.map((i) => i.title);

describe('feed visibility', () => {
  it('shows published church-wide and branch content, but never drafts or scheduled items', async () => {
    const res = await client.get<ContentPage>('/api/v1/content?limit=50');
    expect(res.status).toBe(200);
    const all = titles(res.body);
    expect(all).toContain('Annual Convention registration is open');
    expect(all).toContain('Choir practice moves to Saturdays');
    expect(all).not.toContain('Easter programme');
    expect(all).not.toContain('Prayer evening next Friday');
    expect((await client.get('/api/v1/content/easter-programme-draft')).status).toBe(404);
    expect((await client.get('/api/v1/content/pretoria-prayer-evening')).status).toBe(404);
  });

  it('filters by branch context and scope', async () => {
    const context = (await client.get<ContentPage>('/api/v1/content?branch=cape-town&limit=50'))
      .body;
    expect(context.items.every((i) => i.scope === 'GLOBAL' || i.branch?.slug === 'cape-town')).toBe(
      true,
    );
    expect(titles(context)).toContain('Sunday service now starts at 09:30');
    expect(titles(context)).not.toContain('Choir practice moves to Saturdays');

    const branchOnly = (
      await client.get<ContentPage>('/api/v1/content?branch=cape-town&scope=branch&limit=50')
    ).body;
    // Other test files may publish more Cape Town content into the shared database.
    expect(titles(branchOnly)).toContain('Sunday service now starts at 09:30');
    expect(
      branchOnly.items.every((i) => i.scope === 'BRANCH' && i.branch?.slug === 'cape-town'),
    ).toBe(true);

    const globalOnly = (await client.get<ContentPage>('/api/v1/content?scope=global&limit=50'))
      .body;
    expect(globalOnly.items.every((i) => i.scope === 'GLOBAL' && i.branch === null)).toBe(true);

    expect((await client.get('/api/v1/content?branch=atlantis')).status).toBe(404);
  });

  it('paginates with stable cursors', async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const url = `/api/v1/content?limit=3${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
      const page: ContentPage = (await client.get<ContentPage>(url)).body;
      seen.push(...page.items.map((i) => i.id));
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor && pages < 20);
    const full = (await client.get<ContentPage>('/api/v1/content?limit=50')).body;
    expect(seen).toEqual(full.items.map((i) => i.id));
    expect(new Set(seen).size).toBe(seen.length);
    expect((await client.get('/api/v1/content?cursor=not-a-cursor')).status).toBe(400);
  });

  it('filters by type', async () => {
    const res = await client.get<ContentPage>('/api/v1/content?types=news,baptism&limit=50');
    expect(new Set(res.body.items.map((i) => i.type))).toEqual(new Set(['NEWS', 'BAPTISM']));
    expect((await client.get('/api/v1/content?types=nonsense')).status).toBe(400);
  });

  it('hides content of deleted branches', async () => {
    const kimberley = await ctx.db.branch.findFirstOrThrow({
      where: { slug: 'kimberley', organization: { slug: 'test-church' } },
    });
    await ctx.db.branch.update({ where: { id: kimberley.id }, data: { deletedAt: new Date() } });
    try {
      expect((await client.get('/api/v1/content/kimberley-choir-practice-saturdays')).status).toBe(
        404,
      );
      expect(
        titles((await client.get<ContentPage>('/api/v1/content?limit=50')).body),
      ).not.toContain('Choir practice moves to Saturdays');
      expect((await client.get('/api/v1/branches/kimberley')).status).toBe(404);
    } finally {
      await ctx.db.branch.update({ where: { id: kimberley.id }, data: { deletedAt: null } });
    }
  });
});

describe('events, sermons, home and search', () => {
  it('lists upcoming events soonest first', async () => {
    const page = (await client.get<ContentPage>('/api/v1/events')).body;
    const starts = page.items.map((i) => i.event!.startsAt);
    expect(starts).toEqual([...starts].sort());
    expect(
      page.items.every((i) => new Date(i.event!.startsAt).getTime() > Date.now() - 6 * 3600_000),
    ).toBe(true);
  });

  it('filters sermons by speaker and full-text search', async () => {
    const bySpeaker = (await client.get<ContentPage>('/api/v1/sermons?speaker=elder-t-nkosi')).body;
    expect(titles(bySpeaker).sort()).toEqual(['Faith that endures', 'Walking in the light']);
    const search = (await client.get<ContentPage>('/api/v1/sermons?q=spirit')).body;
    expect(titles(search)).toEqual(['The promise of the Spirit']);
  });

  it('builds the home page for a branch', async () => {
    const home = (await client.get<HomeResponse>('/api/v1/home?branch=johannesburg')).body;
    expect(home.branch?.slug).toBe('johannesburg');
    expect(home.featuredEvent?.title).toBe('Annual Convention');
    expect(home.upcomingEvents.map((e) => e.title)).toContain('Baptism service');
    expect(home.upcomingEvents.map((e) => e.title)).not.toContain('Youth fellowship evening');
  });

  it('searches content by word prefix and branches by name', async () => {
    const res = (await client.get<SearchResponse>('/api/v1/search?q=bapt')).body;
    expect(res.content.map((c) => c.title)).toEqual(
      expect.arrayContaining(['Twelve baptised in Johannesburg', 'Baptism service']),
    );
    const branches = (await client.get<SearchResponse>('/api/v1/search?q=durb')).body;
    expect(branches.branches.map((b) => b.slug)).toEqual(['durban']);
  });

  it('applies temporary schedule changes on branch pages', async () => {
    const branch = (await client.get<BranchDetail>('/api/v1/branches/cape-town')).body;
    const services = branch.schedules.filter((s) => s.kind === 'SERVICE');
    expect(services.map((s) => s.startTime)).toEqual(['09:30']);
    expect(branch.temporaryChanges).toHaveLength(1);
  });
});

describe('baptism enquiries', () => {
  it('accepts an enquiry and notifies the branch in the background', async () => {
    const visitor = new TestClient(ctx.app);
    const res = await visitor.post<{ status: string; message: string }>(
      '/api/v1/baptism-requests',
      {
        branch: 'durban',
        fullName: 'Lindiwe Zulu',
        email: 'Lindiwe.Zulu@Example.org',
        message: 'I would like to know more.',
        consent: true,
      },
    );
    expect(res.status).toBe(202);
    expect(res.body.message).toContain('Durban');
    const stored = await ctx.db.baptismRequest.findFirstOrThrow({
      where: { email: 'lindiwe.zulu@example.org' },
    });
    expect(stored.status).toBe('NEW');
    const jobs = await ctx.jobs.queue('notifications').getJobs(['waiting']);
    expect(
      jobs.some(
        (j) => j.name === 'baptism-request-received' && j.data.baptismRequestId === stored.id,
      ),
    ).toBe(true);
    expect(await queuedEmails(ctx.jobs, 'lindiwe.zulu@example.org')).toEqual([]);
  });

  it('requires consent and a known branch', async () => {
    const visitor = new TestClient(ctx.app);
    expect(
      (
        await visitor.post('/api/v1/baptism-requests', {
          branch: 'durban',
          fullName: 'X',
          email: 'x@example.org',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await visitor.post('/api/v1/baptism-requests', {
          branch: 'atlantis',
          fullName: 'X',
          email: 'x@example.org',
          consent: true,
        })
      ).status,
    ).toBe(404);
  });
});
