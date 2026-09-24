import bcrypt from 'bcryptjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SessionResponse, SessionUser } from '@church/shared';
import {
  createTestContext,
  queuedEmails,
  signUpVerified,
  TEST_PASSWORD as PASSWORD,
  TestClient,
  type TestContext,
  tokenFromUrl,
  uniqueEmail,
} from '../../test/harness.js';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(async () => {
  await ctx?.close();
});

/** Register and confirm a new account; the client is signed in afterwards. */
const registerAndVerify = (client: TestClient, email = uniqueEmail()) => signUpVerified(ctx, client, email);

describe('session and CSRF', () => {
  it('reports anonymous sessions and issues a CSRF cookie', async () => {
    const client = new TestClient(ctx.app);
    const res = await client.get<SessionResponse>('/api/v1/auth/session');
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
    expect(client.cookie('cp_csrf')).toBeTruthy();
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('rejects writes without a CSRF token or from a foreign origin', async () => {
    const client = new TestClient(ctx.app);
    const missing = await client.post('/api/v1/auth/login', { email: 'x@example.org', password: 'x' }, { csrf: false });
    expect(missing.status).toBe(403);
    expect((missing.body as { code: string }).code).toBe('CSRF_REJECTED');

    const foreign = await client.post('/api/v1/auth/login', { email: 'x@example.org', password: 'x' }, { origin: 'https://evil.example' });
    expect(foreign.status).toBe(403);
  });

  it('returns problem details with field errors for invalid input', async () => {
    const client = new TestClient(ctx.app);
    const res = await client.post<{ code: string; errors: { path: string }[] }>('/api/v1/auth/register', {
      email: 'not-an-email',
      password: 'short',
    });
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.errors.map((e) => e.path)).toEqual(
      expect.arrayContaining(['email', 'password', 'firstName', 'lastName', 'acceptTerms']),
    );
  });
});

describe('registration and verification', () => {
  it('registers, requires verification, then signs in via the e-mailed link', async () => {
    const client = new TestClient(ctx.app);
    const email = uniqueEmail('Reg');

    const registered = await client.post('/api/v1/auth/register', {
      email: email.toUpperCase(),
      password: PASSWORD,
      firstName: 'Thandi',
      lastName: 'Mthembu',
      acceptTerms: true,
      // Unknown fields must be ignored (no mass assignment).
      status: 'SUSPENDED',
      emailVerifiedAt: '2020-01-01T00:00:00Z',
    });
    expect(registered.status).toBe(202);
    const user = await ctx.db.user.findUniqueOrThrow({ where: { email: email.toLowerCase() } });
    expect(user.status).toBe('ACTIVE');
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.passwordHash?.startsWith('$argon2id$')).toBe(true);

    const beforeVerify = await client.post<{ code: string }>('/api/v1/auth/login', { email, password: PASSWORD });
    expect(beforeVerify.status).toBe(403);
    expect(beforeVerify.body.code).toBe('EMAIL_NOT_VERIFIED');

    const [message] = await queuedEmails(ctx.jobs, email.toLowerCase());
    if (message?.template !== 'verify-email') throw new Error('expected a verification e-mail');
    const token = tokenFromUrl(message.data.verifyUrl);
    const verified = await client.post<SessionUser>('/api/v1/auth/verify-email', { token });
    expect(verified.status).toBe(200);
    expect(verified.body).toMatchObject({ email: email.toLowerCase(), emailVerified: true, firstName: 'Thandi' });
    expect(client.cookie('cp_session')).toBeTruthy();

    const session = await client.get<SessionResponse>('/api/v1/auth/session');
    expect(session.body.user?.email).toBe(email.toLowerCase());

    const reused = await new TestClient(ctx.app).post<{ code: string }>('/api/v1/auth/verify-email', { token });
    expect(reused.status).toBe(400);
    expect(reused.body.code).toBe('TOKEN_INVALID');
  });

  it('does not reveal existing accounts when registering again', async () => {
    const client = new TestClient(ctx.app);
    const email = await registerAndVerify(client);
    const again = await new TestClient(ctx.app).post('/api/v1/auth/register', {
      email,
      password: 'Another-long-password',
      firstName: 'Someone',
      lastName: 'Else',
      acceptTerms: true,
    });
    expect(again.status).toBe(202);
    const messages = await queuedEmails(ctx.jobs, email);
    expect(messages.some((m) => m.template === 'account-exists')).toBe(true);
    expect(await ctx.db.user.count({ where: { email } })).toBe(1);
  });
});

describe('sign-in', () => {
  it('signs in case-insensitively and signs out', async () => {
    const setup = new TestClient(ctx.app);
    const email = await registerAndVerify(setup);

    const client = new TestClient(ctx.app);
    const login = await client.post<SessionUser>('/api/v1/auth/login', { email: email.toUpperCase(), password: PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.email).toBe(email);

    const logout = await client.post('/api/v1/auth/logout');
    expect(logout.status).toBe(200);
    expect(client.cookie('cp_session')).toBeUndefined();
    expect((await client.get<SessionResponse>('/api/v1/auth/session')).body.user).toBeNull();
  });

  it('uses one generic error for unknown accounts and wrong passwords', async () => {
    const client = new TestClient(ctx.app);
    const email = await registerAndVerify(new TestClient(ctx.app));
    const wrong = await client.post<{ code: string; detail: string }>('/api/v1/auth/login', { email, password: 'wrong-password' });
    const unknown = await client.post<{ code: string; detail: string }>('/api/v1/auth/login', {
      email: uniqueEmail('ghost'),
      password: 'wrong-password',
    });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.detail).toBe(unknown.body.detail);
  });

  it('locks an account progressively after repeated failures', async () => {
    const email = await registerAndVerify(new TestClient(ctx.app));
    const client = new TestClient(ctx.app);
    for (let i = 0; i < 5; i += 1) {
      const res = await client.post('/api/v1/auth/login', { email, password: `wrong-${i}` });
      expect(res.status).toBe(401);
    }
    const locked = await client.post<{ code: string }>('/api/v1/auth/login', { email, password: PASSWORD });
    expect(locked.status).toBe(429);
    expect(locked.body.code).toBe('RATE_LIMITED');
    expect(locked.headers['retry-after']).toBeDefined();
    const user = await ctx.db.user.findUniqueOrThrow({ where: { email } });
    expect(user.lockedUntil?.getTime()).toBeGreaterThan(Date.now());
    expect(await ctx.db.auditLog.count({ where: { entityId: user.id, action: 'auth.account_locked' } })).toBe(1);
  });

  it('throttles unknown addresses like locked accounts', async () => {
    const client = new TestClient(ctx.app);
    const email = uniqueEmail('nobody');
    for (let i = 0; i < 5; i += 1) {
      expect((await client.post('/api/v1/auth/login', { email, password: 'whatever' })).status).toBe(401);
    }
    expect((await client.post('/api/v1/auth/login', { email, password: 'whatever' })).status).toBe(429);
  });

  it('accepts a legacy bcrypt hash once and upgrades it to argon2id', async () => {
    const email = uniqueEmail('legacy');
    await ctx.db.user.create({
      data: {
        email,
        emailVerifiedAt: new Date(),
        passwordHash: await bcrypt.hash('Church@123-legacy', 4),
        profile: { create: { firstName: 'Legacy', lastName: 'User' } },
      },
    });
    const client = new TestClient(ctx.app);
    const res = await client.post('/api/v1/auth/login', { email, password: 'Church@123-legacy' });
    expect(res.status).toBe(200);
    const user = await ctx.db.user.findUniqueOrThrow({ where: { email } });
    expect(user.passwordHash?.startsWith('$argon2id$')).toBe(true);
  });

  it('rejects suspended accounts and invalidates their sessions', async () => {
    const client = new TestClient(ctx.app);
    const email = await registerAndVerify(client);
    expect((await client.get<SessionResponse>('/api/v1/auth/session')).body.user).not.toBeNull();

    await ctx.db.user.update({ where: { email }, data: { status: 'SUSPENDED' } });
    expect((await client.get<SessionResponse>('/api/v1/auth/session')).body.user).toBeNull();
    const login = await new TestClient(ctx.app).post<{ code: string }>('/api/v1/auth/login', { email, password: PASSWORD });
    expect(login.status).toBe(403);
    expect(login.body.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('requires authentication for private routes', async () => {
    const res = await new TestClient(ctx.app).get<{ code: string }>('/api/v1/auth/sessions');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });
});

describe('passwords and devices', () => {
  it('resets a forgotten password, revoking existing sessions', async () => {
    const device = new TestClient(ctx.app);
    const email = await registerAndVerify(device);

    const client = new TestClient(ctx.app);
    const forgot = await client.post('/api/v1/auth/password/forgot', { email });
    expect(forgot.status).toBe(202);
    const unknown = await client.post('/api/v1/auth/password/forgot', { email: uniqueEmail('none') });
    expect(unknown.status).toBe(202);
    expect(unknown.body).toEqual(forgot.body);

    const message = (await queuedEmails(ctx.jobs, email)).find((m) => m.template === 'password-reset');
    if (message?.template !== 'password-reset') throw new Error('expected a reset e-mail');
    const token = tokenFromUrl(message.data.resetUrl);

    const reset = await client.post('/api/v1/auth/password/reset', { token, password: 'A-brand-new-password' });
    expect(reset.status).toBe(200);
    expect((await device.get<SessionResponse>('/api/v1/auth/session')).body.user).toBeNull();
    expect((await client.get<SessionResponse>('/api/v1/auth/session')).body.user?.email).toBe(email);

    expect((await client.post('/api/v1/auth/password/reset', { token, password: 'Yet-another-password' })).status).toBe(400);
    const fresh = new TestClient(ctx.app);
    expect((await fresh.post('/api/v1/auth/login', { email, password: PASSWORD })).status).toBe(401);
    expect((await fresh.post('/api/v1/auth/login', { email, password: 'A-brand-new-password' })).status).toBe(200);
  });

  it('changes the password and signs out other devices only', async () => {
    const laptop = new TestClient(ctx.app);
    const email = await registerAndVerify(laptop);
    const phone = new TestClient(ctx.app);
    expect((await phone.post('/api/v1/auth/login', { email, password: PASSWORD })).status).toBe(200);

    const wrong = await laptop.post<{ errors: { path: string }[] }>('/api/v1/auth/password/change', {
      currentPassword: 'not-it-at-all',
      newPassword: 'Changed-password-123',
    });
    expect(wrong.status).toBe(400);
    expect(wrong.body.errors[0]?.path).toBe('currentPassword');

    const changed = await laptop.post('/api/v1/auth/password/change', {
      currentPassword: PASSWORD,
      newPassword: 'Changed-password-123',
    });
    expect(changed.status).toBe(200);
    expect((await laptop.get<SessionResponse>('/api/v1/auth/session')).body.user).not.toBeNull();
    expect((await phone.get<SessionResponse>('/api/v1/auth/session')).body.user).toBeNull();
  });

  it('lists devices and revokes the others', async () => {
    const a = new TestClient(ctx.app);
    const email = await registerAndVerify(a);
    const b = new TestClient(ctx.app);
    await b.post('/api/v1/auth/login', { email, password: PASSWORD });

    const list = await a.get<{ items: { id: string; current: boolean }[] }>('/api/v1/auth/sessions');
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(2);
    expect(list.body.items.filter((s) => s.current)).toHaveLength(1);

    expect((await a.post('/api/v1/auth/sessions/revoke-others')).status).toBe(200);
    expect((await b.get<SessionResponse>('/api/v1/auth/session')).body.user).toBeNull();
    expect((await a.get<{ items: unknown[] }>('/api/v1/auth/sessions')).body.items).toHaveLength(1);
  });
});
