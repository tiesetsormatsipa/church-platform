import { DEMO_PASSWORD, DEMO_USERS } from '@church/database/seed';
import type { AdminContentDetail, AdminContentList, ContentInput } from '@church/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureDemoData } from '../../test/demo.js';
import { createTestContext, signIn, TestClient, type TestContext } from '../../test/harness.js';

let ctx: TestContext;
const as: Record<'editor' | 'jhbAdmin' | 'churchAdmin' | 'member', TestClient> = {} as never;

beforeAll(async () => {
  ctx = await createTestContext();
  await ensureDemoData(ctx.db);
  const accounts = {
    editor: DEMO_USERS.capeTownEditor,
    jhbAdmin: DEMO_USERS.johannesburgAdmin,
    churchAdmin: DEMO_USERS.churchAdmin,
    member: DEMO_USERS.member,
  } as const;
  for (const [key, email] of Object.entries(accounts)) {
    const client = new TestClient(ctx.app);
    await signIn(client, email, DEMO_PASSWORD);
    as[key as keyof typeof accounts] = client;
  }
});
afterAll(async () => {
  await ctx?.close();
});

let counter = 0;
function announcement(overrides: Partial<ContentInput> = {}): ContentInput {
  counter += 1;
  return {
    type: 'ANNOUNCEMENT',
    scope: 'BRANCH',
    branch: 'cape-town',
    title: `Cape Town notice ${Date.now().toString(36)}-${counter}`,
    summary: 'Short summary',
    body: 'Body text',
    tags: ['Youth', 'Choir'],
    ...overrides,
  };
}

describe('access', () => {
  it('is closed to members without content permissions', async () => {
    expect((await as.member.get('/api/v1/admin/content')).status).toBe(403);
    expect((await new TestClient(ctx.app).get('/api/v1/admin/content')).status).toBe(401);
  });

  it('offers editors only the branches they can write for', async () => {
    const options = await as.editor.get<{ canCreateGlobal: boolean; branches: { slug: string }[] }>(
      '/api/v1/admin/content/options',
    );
    expect(options.body.canCreateGlobal).toBe(false);
    expect(options.body.branches.map((b) => b.slug)).toEqual(['cape-town']);
  });
});

describe('editorial workflow', () => {
  it('lets an editor draft and submit, and a church admin review and publish', async () => {
    const created = await as.editor.post<AdminContentDetail>(
      '/api/v1/admin/content',
      announcement(),
    );
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      status: 'DRAFT',
      scope: 'BRANCH',
      branch: { slug: 'cape-town' },
      tags: ['Choir', 'Youth'],
      rights: { edit: true, submit: true, publish: false, archive: false },
    });
    const { id, slug } = created.body;

    // Not visible to the public, to another branch's admin, or publishable by the editor.
    expect((await as.member.get(`/api/v1/content/${slug}`)).status).toBe(404);
    expect((await as.jhbAdmin.get(`/api/v1/admin/content/${id}`)).status).toBe(404);
    expect((await as.editor.post(`/api/v1/admin/content/${id}/publish`, {})).status).toBe(403);

    const submitted = await as.editor.post<AdminContentDetail>(
      `/api/v1/admin/content/${id}/submit`,
    );
    expect(submitted.body.status).toBe('PENDING_REVIEW');

    const review = await as.churchAdmin.get<AdminContentList>(
      '/api/v1/admin/content?status=PENDING_REVIEW&pageSize=100',
    );
    expect(review.body.items.map((i) => i.id)).toContain(id);

    const published = await as.churchAdmin.post<AdminContentDetail>(
      `/api/v1/admin/content/${id}/publish`,
      {},
    );
    expect(published.status).toBe(200);
    expect(published.body).toMatchObject({ status: 'PUBLISHED', slugLocked: true });
    expect((await as.member.get(`/api/v1/content/${slug}`)).status).toBe(200);

    // The editor can no longer change published content.
    const edit = await as.editor.request('PUT', `/api/v1/admin/content/${id}`, {
      body: announcement({ title: 'Changed' }),
    });
    expect(edit.status).toBe(403);

    // Published slugs are locked; unpublishing hides the item again.
    const relabel = await as.churchAdmin.request('PUT', `/api/v1/admin/content/${id}`, {
      body: announcement({ title: 'Renamed', slug: 'new-address' }),
    });
    expect(relabel.status).toBe(409);
    await as.churchAdmin.post(`/api/v1/admin/content/${id}/unpublish`);
    expect((await as.member.get(`/api/v1/content/${slug}`)).status).toBe(404);

    const audit = await ctx.db.auditLog.findMany({
      where: { entityId: id },
      orderBy: { createdAt: 'asc' },
    });
    expect(audit.map((a) => a.action)).toEqual([
      'content.create',
      'content.submit',
      'content.publish',
      'content.unpublish',
    ]);
    const jobs = await ctx.jobs.queue('web').getJobs(['waiting', 'delayed', 'prioritized']);
    expect(jobs.some((j) => (j.data as { tags: string[] }).tags.includes(`content:${slug}`))).toBe(
      true,
    );
  });

  it('keeps editors and branch admins inside their own scope', async () => {
    expect(
      (await as.editor.post('/api/v1/admin/content', announcement({ branch: 'durban' }))).status,
    ).toBe(403);
    expect(
      (
        await as.editor.post(
          '/api/v1/admin/content',
          announcement({ scope: 'GLOBAL', branch: null }),
        )
      ).status,
    ).toBe(403);
    expect(
      (await as.editor.post('/api/v1/admin/content', announcement({ isPinned: true }))).status,
    ).toBe(403);

    const jhb = await as.jhbAdmin.post<AdminContentDetail>(
      '/api/v1/admin/content',
      announcement({ branch: 'johannesburg', isPinned: true }),
    );
    expect(jhb.status).toBe(201);
    // Moving it to another branch is refused.
    const move = await as.jhbAdmin.request('PUT', `/api/v1/admin/content/${jhb.body.id}`, {
      body: announcement({ branch: 'cape-town', title: jhb.body.title }),
    });
    expect(move.status).toBe(403);
    // Branch admins cannot see other branches' items in their list.
    const list = await as.jhbAdmin.get<AdminContentList>('/api/v1/admin/content?pageSize=100');
    expect(list.body.items.every((i) => i.branch?.slug === 'johannesburg')).toBe(true);
  });

  it('schedules publication for later', async () => {
    const created = await as.churchAdmin.post<AdminContentDetail>(
      '/api/v1/admin/content',
      announcement({ scope: 'GLOBAL', branch: null }),
    );
    const later = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const scheduled = await as.churchAdmin.post<AdminContentDetail>(
      `/api/v1/admin/content/${created.body.id}/publish`,
      { publishAt: later },
    );
    expect(scheduled.body.status).toBe('PUBLISHED');
    expect(scheduled.body.publishedAt).toBe(later);
    expect((await as.member.get(`/api/v1/content/${created.body.slug}`)).status).toBe(404);
  });

  it('lets authors delete their own drafts but not other people’s', async () => {
    const mine = await as.editor.post<AdminContentDetail>('/api/v1/admin/content', announcement());
    const theirs = await as.churchAdmin.post<AdminContentDetail>(
      '/api/v1/admin/content',
      announcement(),
    );
    expect((await as.editor.delete(`/api/v1/admin/content/${theirs.body.id}`)).status).toBe(403);
    expect((await as.editor.delete(`/api/v1/admin/content/${mine.body.id}`)).status).toBe(200);
    expect((await as.editor.get(`/api/v1/admin/content/${mine.body.id}`)).status).toBe(404);
  });
});

describe('typed content', () => {
  it('requires event details for events and lists published events publicly', async () => {
    const missing = await as.churchAdmin.post<{ errors: { path: string }[] }>(
      '/api/v1/admin/content',
      announcement({ type: 'EVENT' }),
    );
    expect(missing.status).toBe(400);
    expect(missing.body.errors.map((e) => e.path)).toContain('event');

    const startsAt = new Date(Date.now() + 10 * 86_400_000).toISOString();
    const event = await as.churchAdmin.post<AdminContentDetail>(
      '/api/v1/admin/content',
      announcement({
        type: 'EVENT',
        title: 'Cape Town picnic',
        event: { startsAt, category: 'FELLOWSHIP', venueName: 'Company’s Garden' },
      }),
    );
    expect(event.status).toBe(201);
    expect(event.body.event).toMatchObject({
      startsAt,
      category: 'FELLOWSHIP',
      eventStatus: 'SCHEDULED',
    });
    await as.churchAdmin.post(`/api/v1/admin/content/${event.body.id}/publish`, {});
    const events = await as.member.get<{ items: { slug: string }[] }>(
      '/api/v1/events?branch=cape-town&limit=50',
    );
    expect(events.body.items.map((i) => i.slug)).toContain(event.body.slug);

    const backwards = await as.churchAdmin.post(
      '/api/v1/admin/content',
      announcement({
        type: 'EVENT',
        event: { startsAt, endsAt: new Date(Date.now()).toISOString() },
      }),
    );
    expect(backwards.status).toBe(400);
  });

  it('links sermons to speakers and series that exist', async () => {
    const unknown = await as.churchAdmin.post(
      '/api/v1/admin/content',
      announcement({
        type: 'SERMON',
        sermon: { preachedOn: '2026-09-20', speaker: 'nobody-here' },
      }),
    );
    expect(unknown.status).toBe(400);

    const speaker = await as.churchAdmin.post<{ slug: string }>('/api/v1/admin/speakers', {
      name: 'Pastor A. Visitor',
    });
    expect(speaker.status).toBe(201);
    const sermon = await as.churchAdmin.post<AdminContentDetail>(
      '/api/v1/admin/content',
      announcement({
        type: 'SERMON',
        title: 'Guest sermon',
        sermon: { preachedOn: '2026-09-20', speaker: speaker.body.slug, scripture: 'Psalm 23' },
      }),
    );
    expect(sermon.status).toBe(201);
    expect(sermon.body.sermon).toMatchObject({
      preachedOn: '2026-09-20',
      speaker: speaker.body.slug,
      scripture: 'Psalm 23',
    });
  });
});
