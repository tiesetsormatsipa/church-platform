import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AdminContentDetail, RoleList } from '@church/shared';
import { DEMO_PASSWORD, DEMO_USERS } from '@church/database/seed';
import { createTestContext, signIn, TestClient, type TestContext } from '../../test/harness.js';
import { ensureDemoData } from '../../test/demo.js';

let ctx: TestContext;
let churchAdmin: TestClient;
let superAdmin: TestClient;
let auxiliary: TestClient;
let auxiliaryEmail: string;

beforeAll(async () => {
  ctx = await createTestContext();
  await ensureDemoData(ctx.db);

  churchAdmin = new TestClient(ctx.app);
  await signIn(churchAdmin, DEMO_USERS.churchAdmin, DEMO_PASSWORD);
  superAdmin = new TestClient(ctx.app);
  await signIn(superAdmin, DEMO_USERS.superAdmin, DEMO_PASSWORD);

  // A member appointed to the songs auxiliary for Johannesburg, by the church administrator.
  auxiliaryEmail = DEMO_USERS.member;
  auxiliary = new TestClient(ctx.app);
  await signIn(auxiliary, auxiliaryEmail, DEMO_PASSWORD);
});

afterAll(async () => {
  await ctx?.close();
});

async function userIdOf(email: string) {
  const user = await ctx.db.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
  return user.id;
}

describe('the role catalogue', () => {
  it('reports each role’s seniority and the content it covers', async () => {
    const response = await churchAdmin.get<RoleList>('/api/v1/admin/roles');
    expect(response.status).toBe(200);
    const byKey = new Map(response.body.items.map((r) => [r.key, r]));

    expect(byKey.get('super_admin')?.rank).toBeLessThan(byKey.get('church_admin')!.rank);
    expect(byKey.get('church_admin')?.rank).toBeLessThan(byKey.get('branch_admin')!.rank);
    expect(byKey.get('branch_admin')?.rank).toBeLessThan(byKey.get('songs_auxiliary')!.rank);

    expect(byKey.get('songs_auxiliary')?.contentTypes).toEqual(['SONG']);
    expect(byKey.get('sermons_auxiliary')?.contentTypes).toEqual(['SERMON']);
    // An ordinary administrator is not limited to any type.
    expect(byKey.get('church_admin')?.contentTypes).toEqual([]);
  });
});

describe('seniority', () => {
  it('refuses to hand out a role of equal rank', async () => {
    const id = await userIdOf(DEMO_USERS.johannesburgAdmin);
    const response = await churchAdmin.post(`/api/v1/admin/users/${id}/roles`, {
      role: 'church_admin',
      branch: null,
    });
    expect(response.status).toBe(403);
  });

  it('refuses to hand out a more senior role', async () => {
    const id = await userIdOf(DEMO_USERS.johannesburgAdmin);
    const response = await churchAdmin.post(`/api/v1/admin/users/${id}/roles`, {
      role: 'super_admin',
      branch: null,
    });
    expect(response.status).toBe(403);
  });

  it('will not let a church administrator act on a super administrator', async () => {
    const id = await userIdOf(DEMO_USERS.superAdmin);
    const detail = await churchAdmin.get<{ canManageStatus: boolean }>(`/api/v1/admin/users/${id}`);
    if (detail.status === 200) expect(detail.body.canManageStatus).toBe(false);

    const suspend = await churchAdmin.request('PATCH', `/api/v1/admin/users/${id}/status`, {
      body: { status: 'SUSPENDED', reason: 'Testing seniority' },
    });
    expect([403, 404]).toContain(suspend.status);
  });

  it('lets a super administrator act on a church administrator', async () => {
    const id = await userIdOf(DEMO_USERS.churchAdmin);
    const detail = await superAdmin.get<{ canManageStatus: boolean }>(`/api/v1/admin/users/${id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.canManageStatus).toBe(true);
  });
});

describe('an auxiliary appointed to the songs', () => {
  let branchId: string;

  beforeAll(async () => {
    const branch = await ctx.db.branch.findFirstOrThrow({
      where: { slug: 'johannesburg' },
      select: { id: true },
    });
    branchId = branch.id;

    const memberId = await userIdOf(auxiliaryEmail);
    const assign = await churchAdmin.post(`/api/v1/admin/users/${memberId}/roles`, {
      role: 'songs_auxiliary',
      branch: 'johannesburg',
    });
    expect([201, 409]).toContain(assign.status);
    // The session predates the new role, so sign in again to pick it up.
    auxiliary = new TestClient(ctx.app);
    await signIn(auxiliary, auxiliaryEmail, DEMO_PASSWORD);
  });

  it('may draft a song for its branch', async () => {
    const response = await auxiliary.post<AdminContentDetail>('/api/v1/admin/content', {
      type: 'SONG',
      scope: 'BRANCH',
      branch: 'johannesburg',
      title: `Auxiliary song ${Date.now().toString(36)}`,
    });
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('DRAFT');
    // It may put its own draft forward, but it may not publish it.
    expect(response.body.rights.submit).toBe(true);
    expect(response.body.rights.publish).toBe(false);
  });

  it('may not draft a sermon, which is another auxiliary’s job', async () => {
    const response = await auxiliary.post('/api/v1/admin/content', {
      type: 'SERMON',
      scope: 'BRANCH',
      branch: 'johannesburg',
      title: `Auxiliary sermon ${Date.now().toString(36)}`,
      // A complete sermon, so the refusal is about authority and not a missing field.
      sermon: { preachedOn: '2026-01-04', speakerName: 'Elder T. Nkosi' },
    });
    expect(response.status).toBe(403);
  });

  it('may not draft news either', async () => {
    const response = await auxiliary.post('/api/v1/admin/content', {
      type: 'NEWS',
      scope: 'BRANCH',
      branch: 'johannesburg',
      title: `Auxiliary news ${Date.now().toString(36)}`,
    });
    expect(response.status).toBe(403);
  });

  it('may not post a song for another branch', async () => {
    const response = await auxiliary.post('/api/v1/admin/content', {
      type: 'SONG',
      scope: 'BRANCH',
      branch: 'cape-town',
      title: `Auxiliary elsewhere ${Date.now().toString(36)}`,
    });
    expect(response.status).toBe(403);
  });

  it('may not post a church-wide song', async () => {
    const response = await auxiliary.post('/api/v1/admin/content', {
      type: 'SONG',
      scope: 'GLOBAL',
      branch: null,
      title: `Auxiliary global ${Date.now().toString(36)}`,
    });
    expect(response.status).toBe(403);
  });

  afterAll(async () => {
    await ctx.db.contentItem.deleteMany({ where: { title: { startsWith: 'Auxiliary ' } } });
    await ctx.db.roleAssignment.deleteMany({
      where: { userId: await userIdOf(auxiliaryEmail), branchId },
    });
  });
});
