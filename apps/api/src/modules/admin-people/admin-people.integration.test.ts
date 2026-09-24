import { DEMO_PASSWORD, DEMO_USERS } from '@church/database/seed';
import type {
  AccountProfile,
  AdminBaptismList,
  AdminBaptismRequest,
  AdminMembershipList,
  AdminMembershipRow,
  AdminUserDetail,
  AdminUserList,
  MembershipDto,
  SessionResponse,
} from '@church/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureDemoData } from '../../test/demo.js';
import {
  createTestContext,
  signIn,
  signUpVerified,
  TestClient,
  type TestContext,
  uniqueEmail,
} from '../../test/harness.js';

let ctx: TestContext;
let jhbAdmin: TestClient;
let churchAdmin: TestClient;
let member: TestClient;

async function client(email: string) {
  const c = new TestClient(ctx.app);
  await signIn(c, email, DEMO_PASSWORD);
  return c;
}

async function userId(email: string) {
  return (await ctx.db.user.findUniqueOrThrow({ where: { email }, select: { id: true } })).id;
}

/** A new verified account that has asked to join `branch`. */
async function applicant(branch: string) {
  const c = new TestClient(ctx.app);
  const email = await signUpVerified(ctx, c, uniqueEmail('applicant'));
  const request = await c.post<MembershipDto>('/api/v1/me/memberships', { branch });
  expect(request.status).toBe(201);
  return { client: c, email, id: await userId(email), membershipId: request.body.id };
}

beforeAll(async () => {
  ctx = await createTestContext();
  await ensureDemoData(ctx.db);
  jhbAdmin = await client(DEMO_USERS.johannesburgAdmin);
  churchAdmin = await client(DEMO_USERS.churchAdmin);
  member = await client(DEMO_USERS.member);
});
afterAll(async () => {
  await ctx?.close();
});

describe('membership review', () => {
  it('is limited to the reviewer’s branches', async () => {
    const capeTown = await applicant('cape-town');
    const list = await jhbAdmin.get<AdminMembershipList>(
      '/api/v1/admin/memberships?status=PENDING&pageSize=100',
    );
    expect(list.status).toBe(200);
    expect(list.body.items.every((m) => m.branch.slug === 'johannesburg')).toBe(true);
    const foreign = await jhbAdmin.post(
      `/api/v1/admin/memberships/${capeTown.membershipId}/decision`,
      {
        decision: 'APPROVE',
      },
    );
    expect(foreign.status).toBe(404);
    expect((await member.get('/api/v1/admin/memberships')).status).toBe(403);
  });

  it('approves, declines with a note, and refuses to decide twice', async () => {
    const approved = await applicant('johannesburg');
    const ok = await jhbAdmin.post<AdminMembershipRow>(
      `/api/v1/admin/memberships/${approved.membershipId}/decision`,
      {
        decision: 'APPROVE',
      },
    );
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ status: 'ACTIVE', decidedBy: expect.any(String) });
    const profile = (await approved.client.get<AccountProfile>('/api/v1/me/profile')).body;
    expect(profile.homeBranch?.slug).toBe('johannesburg');
    expect(
      (
        await jhbAdmin.post(`/api/v1/admin/memberships/${approved.membershipId}/decision`, {
          decision: 'APPROVE',
        })
      ).status,
    ).toBe(409);

    const declined = await applicant('johannesburg');
    await jhbAdmin.post(`/api/v1/admin/memberships/${declined.membershipId}/decision`, {
      decision: 'REJECT',
      note: 'Please speak to us after the service first.',
    });
    const mine = (await declined.client.get<AccountProfile>('/api/v1/me/profile')).body
      .memberships[0];
    expect(mine).toMatchObject({
      status: 'REJECTED',
      decisionNote: 'Please speak to us after the service first.',
    });

    const jobs = await ctx.jobs
      .queue('notifications')
      .getJobs(['waiting', 'delayed', 'prioritized']);
    expect(
      jobs.some(
        (j) => (j.data as { membershipId?: string }).membershipId === approved.membershipId,
      ),
    ).toBe(true);
  });
});

describe('baptism enquiries', () => {
  async function enquire(branch: string) {
    const visitor = new TestClient(ctx.app);
    await visitor.get('/api/v1/auth/csrf');
    const res = await visitor.post('/api/v1/baptism-requests', {
      branch,
      fullName: `Visitor ${branch}`,
      email: uniqueEmail('visitor'),
      consent: true,
    });
    expect(res.status).toBe(202);
  }

  it('shows each branch its own enquiries and tracks follow-up', async () => {
    await enquire('johannesburg');
    await enquire('durban');
    const list = await jhbAdmin.get<AdminBaptismList>(
      '/api/v1/admin/baptism-requests?status=NEW&pageSize=100',
    );
    expect(list.body.items.length).toBeGreaterThan(0);
    expect(list.body.items.every((r) => r.branch.slug === 'johannesburg')).toBe(true);
    const request = list.body.items[0]!;

    const notAllowed = await jhbAdmin.request(
      'PATCH',
      `/api/v1/admin/baptism-requests/${request.id}`,
      {
        body: { assigneeId: await userId(DEMO_USERS.member) },
      },
    );
    expect(notAllowed.status).toBe(400);

    const updated = await jhbAdmin.request<AdminBaptismRequest>(
      'PATCH',
      `/api/v1/admin/baptism-requests/${request.id}`,
      {
        body: {
          status: 'CONTACTED',
          assigneeId: await userId(DEMO_USERS.johannesburgAdmin),
          internalNotes: 'Called on Monday.',
        },
      },
    );
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ status: 'CONTACTED', internalNotes: 'Called on Monday.' });
    expect(updated.body.handledAt).not.toBeNull();

    const durban = (
      await churchAdmin.get<AdminBaptismList>('/api/v1/admin/baptism-requests?branch=durban')
    ).body.items[0]!;
    const cross = await jhbAdmin.request('PATCH', `/api/v1/admin/baptism-requests/${durban.id}`, {
      body: { status: 'CLOSED' },
    });
    expect(cross.status).toBe(404);
  });
});

describe('people and roles', () => {
  it('shows branch admins only their branch’s members and church admins everyone', async () => {
    expect((await member.get('/api/v1/admin/users')).status).toBe(403);
    const branchView = await jhbAdmin.get<AdminUserList>('/api/v1/admin/users?pageSize=100');
    expect(branchView.status).toBe(200);
    const emails = branchView.body.items.map((u) => u.email);
    expect(emails).toContain(DEMO_USERS.member);
    expect(emails).not.toContain(DEMO_USERS.pendingMember);

    const search = await churchAdmin.get<AdminUserList>(
      `/api/v1/admin/users?q=${encodeURIComponent('newmember')}`,
    );
    expect(search.body.items.map((u) => u.email)).toEqual([DEMO_USERS.pendingMember]);
  });

  it('lets branch admins give branch roles in their branch only (no escalation)', async () => {
    const person = await applicant('johannesburg');
    await jhbAdmin.post(`/api/v1/admin/memberships/${person.membershipId}/decision`, {
      decision: 'APPROVE',
    });

    const editor = await jhbAdmin.post<AdminUserDetail>(`/api/v1/admin/users/${person.id}/roles`, {
      role: 'branch_editor',
      branch: 'johannesburg',
    });
    expect(editor.status).toBe(201);
    expect(editor.body.assignments.map((a) => [a.role.key, a.branch?.slug])).toEqual([
      ['branch_editor', 'johannesburg'],
    ]);

    const duplicate = await jhbAdmin.post(`/api/v1/admin/users/${person.id}/roles`, {
      role: 'branch_editor',
      branch: 'johannesburg',
    });
    expect(duplicate.status).toBe(409);
    expect(
      (
        await jhbAdmin.post(`/api/v1/admin/users/${person.id}/roles`, {
          role: 'church_admin',
          branch: null,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await jhbAdmin.post(`/api/v1/admin/users/${person.id}/roles`, {
          role: 'branch_editor',
          branch: 'cape-town',
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await jhbAdmin.post(`/api/v1/admin/users/${person.id}/roles`, {
          role: 'branch_editor',
          branch: null,
        })
      ).status,
    ).toBe(400);

    // The new editor can now write for Johannesburg.
    const options = await person.client.get<{ branches: { slug: string }[] }>(
      '/api/v1/admin/content/options',
    );
    expect(options.body.branches.map((b) => b.slug)).toEqual(['johannesburg']);

    const assignmentId = editor.body.assignments[0]!.id;
    const revoked = await jhbAdmin.delete<AdminUserDetail>(
      `/api/v1/admin/users/${person.id}/roles/${assignmentId}`,
    );
    expect(revoked.status).toBe(200);
    expect(revoked.body.assignments).toEqual([]);

    const self = await jhbAdmin.get<AdminUserDetail>(
      `/api/v1/admin/users/${await userId(DEMO_USERS.johannesburgAdmin)}`,
    );
    expect(self.body.assignments.every((a) => !a.revocable)).toBe(true);

    const audit = await ctx.db.auditLog.findMany({
      where: { action: { in: ['role.assign', 'role.revoke'] }, entityId: assignmentId },
    });
    expect(audit.map((a) => a.action).sort()).toEqual(['role.assign', 'role.revoke']);
  });

  it('suspends accounts (signing them out) but never someone more powerful', async () => {
    const person = await applicant('cape-town');
    expect(
      (await person.client.get<SessionResponse>('/api/v1/auth/session')).body.user,
    ).not.toBeNull();

    expect(
      (
        await jhbAdmin.request('PATCH', `/api/v1/admin/users/${person.id}/status`, {
          body: { status: 'SUSPENDED' },
        })
      ).status,
    ).toBe(403);
    const suspended = await churchAdmin.request<AdminUserDetail>(
      'PATCH',
      `/api/v1/admin/users/${person.id}/status`,
      {
        body: { status: 'SUSPENDED', reason: 'Spam' },
      },
    );
    expect(suspended.status).toBe(200);
    expect(suspended.body).toMatchObject({ status: 'SUSPENDED', statusReason: 'Spam' });
    expect((await person.client.get<SessionResponse>('/api/v1/auth/session')).body.user).toBeNull();

    const reactivated = await churchAdmin.request<AdminUserDetail>(
      'PATCH',
      `/api/v1/admin/users/${person.id}/status`,
      {
        body: { status: 'ACTIVE' },
      },
    );
    expect(reactivated.body.status).toBe('ACTIVE');

    const superAdminId = await userId(DEMO_USERS.superAdmin);
    const detail = await churchAdmin.get<AdminUserDetail>(`/api/v1/admin/users/${superAdminId}`);
    expect(detail.body.canManageStatus).toBe(false);
    expect(
      (
        await churchAdmin.request('PATCH', `/api/v1/admin/users/${superAdminId}/status`, {
          body: { status: 'SUSPENDED' },
        })
      ).status,
    ).toBe(403);
  });
});
