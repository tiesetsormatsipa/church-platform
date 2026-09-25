import { DEMO_PASSWORD, DEMO_USERS } from '@church/database/seed';
import type {
  AdminBranchDetail,
  AdminOrganization,
  AdminSummary,
  AuditList,
  BranchDetail,
  PublicOrganization,
} from '@church/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureDemoData } from '../../test/demo.js';
import {
  createTestContext,
  signIn,
  TestClient,
  type TestContext,
  uniqueEmail,
} from '../../test/harness.js';

let ctx: TestContext;
let jhbAdmin: TestClient;
let churchAdmin: TestClient;
let superAdmin: TestClient;
let member: TestClient;
let visitor: TestClient;

async function client(email: string) {
  const c = new TestClient(ctx.app);
  await signIn(c, email, DEMO_PASSWORD);
  return c;
}

beforeAll(async () => {
  ctx = await createTestContext();
  await ensureDemoData(ctx.db);
  jhbAdmin = await client(DEMO_USERS.johannesburgAdmin);
  churchAdmin = await client(DEMO_USERS.churchAdmin);
  superAdmin = await client(DEMO_USERS.superAdmin);
  member = await client(DEMO_USERS.member);
  visitor = new TestClient(ctx.app);
});
afterAll(async () => {
  await ctx?.close();
});

describe('summary', () => {
  it('reports the areas each person can use', async () => {
    const forMember = (await member.get<AdminSummary>('/api/v1/admin/summary')).body;
    expect(Object.values(forMember.areas).every((v) => v === false)).toBe(true);

    const forBranchAdmin = (await jhbAdmin.get<AdminSummary>('/api/v1/admin/summary')).body.areas;
    expect(forBranchAdmin).toEqual({
      content: true,
      memberships: true,
      people: true,
      branches: true,
      audit: false,
      settings: false,
    });
    expect((await superAdmin.get<AdminSummary>('/api/v1/admin/summary')).body.areas.settings).toBe(
      true,
    );

    const counts = (await churchAdmin.get<AdminSummary>('/api/v1/admin/summary')).body.counts;
    expect(counts.pendingMemberships).toBeGreaterThanOrEqual(1);
    expect(counts.upcomingEvents).toBeGreaterThanOrEqual(1);
  });
});

describe('branches', () => {
  it('lets branch admins edit their own branch only', async () => {
    const list = (
      await jhbAdmin.get<{ items: { slug: string; canEdit: boolean }[] }>('/api/v1/admin/branches')
    ).body;
    expect(list.items.map((b) => b.slug)).toEqual(['johannesburg']);

    const current = (await jhbAdmin.get<AdminBranchDetail>('/api/v1/admin/branches/johannesburg'))
      .body;
    const updated = await jhbAdmin.request<AdminBranchDetail>(
      'PUT',
      '/api/v1/admin/branches/johannesburg',
      {
        body: {
          ...current,
          parentBranch: null,
          description: 'Visitors are always welcome. Parking behind the hall.',
          phone: '011 000 0000',
        },
      },
    );
    expect(updated.status).toBe(200);
    expect(updated.body.phone).toBe('011 000 0000');
    const publicView = (await visitor.get<BranchDetail>('/api/v1/branches/johannesburg')).body;
    expect(publicView.description).toContain('Parking behind the hall');

    expect((await jhbAdmin.get('/api/v1/admin/branches/cape-town')).status).toBe(404);
    const rename = await jhbAdmin.request('PUT', '/api/v1/admin/branches/johannesburg', {
      body: { ...current, parentBranch: null, slug: 'joburg' },
    });
    expect(rename.status).toBe(409);
    expect((await member.get('/api/v1/admin/branches')).status).toBe(403);
  });

  it('creates, nests, archives and restores branches (church admins)', async () => {
    expect((await jhbAdmin.post('/api/v1/admin/branches', { name: 'Soweto' })).status).toBe(403);
    const created = await churchAdmin.post<AdminBranchDetail>('/api/v1/admin/branches', {
      name: 'Soweto',
      type: 'SUB',
      parentBranch: 'johannesburg',
      city: 'Soweto',
      province: 'Gauteng',
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      slug: 'soweto',
      parentBranch: { slug: 'johannesburg' },
      status: 'ACTIVE',
    });

    // Johannesburg cannot become a child of its own sub-branch.
    const jhb = (await churchAdmin.get<AdminBranchDetail>('/api/v1/admin/branches/johannesburg'))
      .body;
    const cycle = await churchAdmin.request('PUT', '/api/v1/admin/branches/johannesburg', {
      body: { ...jhb, parentBranch: 'soweto' },
    });
    expect(cycle.status).toBe(400);

    await churchAdmin.post('/api/v1/admin/branches/soweto/archive');
    expect((await visitor.get('/api/v1/branches/soweto')).status).toBe(404);
    await churchAdmin.post('/api/v1/admin/branches/soweto/restore');
    expect((await visitor.get('/api/v1/branches/soweto')).status).toBe(200);
  });

  it('manages service times and leaders', async () => {
    const invalid = await jhbAdmin.post<{ errors: { path: string }[] }>(
      '/api/v1/admin/branches/johannesburg/schedules',
      {
        kind: 'SERVICE',
      },
    );
    expect(invalid.status).toBe(400);
    expect(invalid.body.errors.map((e) => e.path)).toContain('dayOfWeek');

    const added = await jhbAdmin.post<AdminBranchDetail>(
      '/api/v1/admin/branches/johannesburg/schedules',
      {
        kind: 'YOUTH',
        title: 'Youth meeting',
        dayOfWeek: 6,
        startTime: '16:00',
        endTime: '18:00',
      },
    );
    expect(added.status).toBe(201);
    const schedule = added.body.schedules.find((s) => s.title === 'Youth meeting')!;
    expect(schedule).toMatchObject({ dayOfWeek: 6, startTime: '16:00' });
    const publicTimes = (await visitor.get<BranchDetail>('/api/v1/branches/johannesburg')).body
      .schedules;
    expect(publicTimes.map((s) => s.title)).toContain('Youth meeting');

    const moved = await jhbAdmin.request<AdminBranchDetail>(
      'PUT',
      `/api/v1/admin/branches/johannesburg/schedules/${schedule.id}`,
      {
        body: { kind: 'YOUTH', title: 'Youth meeting', dayOfWeek: 5, startTime: '18:30' },
      },
    );
    expect(moved.body.schedules.find((s) => s.id === schedule.id)).toMatchObject({
      dayOfWeek: 5,
      startTime: '18:30',
    });
    // Another branch's schedule id is not found through this branch.
    const capeTownSchedule = await ctx.db.branchSchedule.findFirstOrThrow({
      where: { branch: { slug: 'cape-town' } },
    });
    expect(
      (
        await jhbAdmin.delete(
          `/api/v1/admin/branches/johannesburg/schedules/${capeTownSchedule.id}`,
        )
      ).status,
    ).toBe(404);
    expect(
      (await jhbAdmin.delete(`/api/v1/admin/branches/johannesburg/schedules/${schedule.id}`))
        .status,
    ).toBe(200);

    const leader = await jhbAdmin.post<AdminBranchDetail>(
      '/api/v1/admin/branches/johannesburg/leaders',
      {
        name: 'Bro. K. Molefe',
        title: 'Youth leader',
      },
    );
    expect(leader.body.leaders.map((l) => l.name)).toContain('Bro. K. Molefe');
  });
});

describe('audit log', () => {
  it('is available to church administrators only', async () => {
    expect((await jhbAdmin.get('/api/v1/admin/audit')).status).toBe(403);
    const log = await churchAdmin.get<AuditList>(
      '/api/v1/admin/audit?entityType=Branch&pageSize=50',
    );
    expect(log.status).toBe(200);
    expect(
      log.body.items.some(
        (e) => e.action === 'branch.update' && e.actor?.email === DEMO_USERS.johannesburgAdmin,
      ),
    ).toBe(true);
  });
});

describe('settings', () => {
  it('are managed by super administrators and take effect immediately', async () => {
    expect((await churchAdmin.get('/api/v1/admin/settings')).status).toBe(403);
    const current = (await superAdmin.get<AdminOrganization>('/api/v1/admin/settings')).body;
    try {
      const closed = await superAdmin.request<AdminOrganization>('PUT', '/api/v1/admin/settings', {
        body: { ...current, registrationOpen: false, tagline: 'Growing together' },
      });
      expect(closed.status).toBe(200);
      const org = (await visitor.get<PublicOrganization>('/api/v1/organization')).body;
      expect(org).toMatchObject({ registrationOpen: false, tagline: 'Growing together' });
      const signup = await visitor.post<{ code: string }>('/api/v1/auth/register', {
        email: uniqueEmail(),
        password: 'A-sufficiently-long-password',
        firstName: 'Late',
        lastName: 'Comer',
        acceptTerms: true,
      });
      expect(signup.status).toBe(403);
      expect(signup.body.code).toBe('REGISTRATION_CLOSED');
    } finally {
      await superAdmin.request('PUT', '/api/v1/admin/settings', { body: current });
    }
  });
});
