import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AccountProfile, MembershipDto, NotificationPreferences } from '@church/shared';
import { ensureDemoData } from '../../test/demo.js';
import { createTestContext, signUpVerified, TestClient, type TestContext } from '../../test/harness.js';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
  await ensureDemoData(ctx.db);
});
afterAll(async () => {
  await ctx?.close();
});

async function member(): Promise<TestClient> {
  const client = new TestClient(ctx.app);
  await signUpVerified(ctx, client);
  return client;
}

describe('profile', () => {
  it('requires a session', async () => {
    const anonymous = new TestClient(ctx.app);
    expect((await anonymous.get('/api/v1/me/profile')).status).toBe(401);
  });

  it('reads and updates your own profile', async () => {
    const client = await member();
    const initial = await client.get<AccountProfile>('/api/v1/me/profile');
    expect(initial.status).toBe(200);
    expect(initial.body).toMatchObject({ firstName: 'Test', lastName: 'Person', emailVerified: true, homeBranch: null, memberships: [] });

    const updated = await client.patch<AccountProfile>('/api/v1/me/profile', {
      firstName: '  Thandi ',
      displayName: 'Thandi M.',
      phone: '082 000 0000',
      homeBranch: 'cape-town',
    });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      firstName: 'Thandi',
      lastName: 'Person',
      displayName: 'Thandi M.',
      phone: '082 000 0000',
      homeBranch: { slug: 'cape-town', name: 'Cape Town' },
    });

    const cleared = await client.patch<AccountProfile>('/api/v1/me/profile', { displayName: '', homeBranch: null });
    expect(cleared.body).toMatchObject({ displayName: null, homeBranch: null, phone: '082 000 0000' });

    const audit = await ctx.db.auditLog.findFirst({ where: { actorId: initial.body.id, action: 'profile.update' } });
    expect(JSON.stringify(audit?.changes)).not.toContain('082');
  });

  it('validates input and rejects unknown branches', async () => {
    const client = await member();
    const invalid = await client.patch<{ code: string; errors: { path: string; message: string }[] }>('/api/v1/me/profile', { firstName: ' ' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.errors).toEqual([{ path: 'firstName', message: 'This field is required' }]);
    expect((await client.patch('/api/v1/me/profile', { homeBranch: 'atlantis' })).status).toBe(404);
  });

  it('needs the CSRF token to change anything', async () => {
    const client = await member();
    const res = await client.request('PATCH', '/api/v1/me/profile', { body: { firstName: 'X' }, csrf: false });
    expect(res.status).toBe(403);
  });
});

describe('branch membership', () => {
  it('requests, prevents duplicates, and can be withdrawn', async () => {
    const client = await member();
    const requested = await client.post<MembershipDto>('/api/v1/me/memberships', { branch: 'cape-town', message: 'We moved here.' });
    expect(requested.status).toBe(201);
    expect(requested.body).toMatchObject({ status: 'PENDING', isPrimary: true, branch: { slug: 'cape-town' } });

    const again = await client.post<{ code: string }>('/api/v1/me/memberships', { branch: 'cape-town' });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('MEMBERSHIP_EXISTS');
    const elsewhere = await client.post<{ code: string }>('/api/v1/me/memberships', { branch: 'durban' });
    expect(elsewhere.status).toBe(409);
    expect(elsewhere.body.code).toBe('MEMBERSHIP_ELSEWHERE');

    const queued = await ctx.jobs.queue('notifications').getJobs(['waiting', 'delayed', 'prioritized', 'active', 'completed']);
    expect(queued.some((job) => (job.data as { membershipId?: string }).membershipId === requested.body.id)).toBe(true);

    // Someone else cannot touch it.
    const stranger = await member();
    expect((await stranger.delete(`/api/v1/me/memberships/${requested.body.id}`)).status).toBe(404);

    const withdrawn = await client.delete<MembershipDto>(`/api/v1/me/memberships/${requested.body.id}`);
    expect(withdrawn.status).toBe(200);
    expect(withdrawn.body).toMatchObject({ status: 'LEFT', isPrimary: false });

    const durban = await client.post<MembershipDto>('/api/v1/me/memberships', { branch: 'durban' });
    expect(durban.status).toBe(201);
    const profile = (await client.get<AccountProfile>('/api/v1/me/profile')).body;
    expect(profile.memberships.map((m) => [m.branch.slug, m.status])).toEqual([
      ['durban', 'PENDING'],
      ['cape-town', 'LEFT'],
    ]);
  });
});

describe('notification preferences', () => {
  it('starts from the organisation defaults and keeps security e-mails on', async () => {
    const client = await member();
    const defaults = (await client.get<NotificationPreferences>('/api/v1/me/notification-preferences')).body.items;
    expect(defaults).toHaveLength(8);
    expect(defaults.find((p) => p.category === 'EVENTS')).toEqual({ category: 'EVENTS', inApp: true, email: false });

    const updated = await client.put<NotificationPreferences>('/api/v1/me/notification-preferences', {
      items: [
        { category: 'EVENTS', inApp: false, email: true },
        { category: 'ACCOUNT', inApp: true, email: false },
      ],
    });
    expect(updated.status).toBe(200);
    expect(updated.body.items.find((p) => p.category === 'EVENTS')).toEqual({ category: 'EVENTS', inApp: false, email: true });
    expect(updated.body.items.find((p) => p.category === 'ACCOUNT')?.email).toBe(true);

    const duplicate = await client.put('/api/v1/me/notification-preferences', {
      items: [
        { category: 'NEWS', inApp: true, email: true },
        { category: 'NEWS', inApp: false, email: false },
      ],
    });
    expect(duplicate.status).toBe(400);
  });
});
