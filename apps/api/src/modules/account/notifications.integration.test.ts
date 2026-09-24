import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NotificationsPage, NotificationsUnread } from '@church/shared';
import {
  createTestContext,
  signUpVerified,
  TestClient,
  type TestContext,
} from '../../test/harness.js';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx?.close();
});

/** A fresh, verified account plus its user id. */
async function newMember(): Promise<{ client: TestClient; userId: string }> {
  const client = new TestClient(ctx.app);
  const email = await signUpVerified(ctx, client);
  const user = await ctx.db.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
  return { client, userId: user.id };
}

/** Creates notifications straight in the database: the worker is what normally writes them. */
async function give(userId: string, count: number, prefix = 'Notice') {
  await ctx.db.notification.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      userId,
      category: 'ANNOUNCEMENTS' as const,
      title: `${prefix} ${i + 1}`,
      body: null,
      url: '/feed',
      dedupeKey: `${prefix}-${userId}-${i}`,
    })),
  });
}

describe('GET /me/notifications', () => {
  it('requires a session', async () => {
    const client = new TestClient(ctx.app);
    const response = await client.get('/api/v1/me/notifications');
    expect(response.status).toBe(401);
  });

  it("lists the caller's notifications newest first with an unread count", async () => {
    const { client, userId } = await newMember();
    await give(userId, 3);

    const response = await client.get<NotificationsPage>('/api/v1/me/notifications');

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(3);
    expect(response.body.items[0]?.title).toBe('Notice 3');
    expect(response.body.items[0]?.url).toBe('/feed');
    expect(response.body.unread).toBe(3);
    expect(response.body.nextCursor).toBeNull();
  });

  it('never shows another person their notifications', async () => {
    const mine = await newMember();
    const theirs = await newMember();
    await give(theirs.userId, 2, 'Private');

    const response = await mine.client.get<NotificationsPage>('/api/v1/me/notifications');

    expect(response.status).toBe(200);
    expect(response.body.items.map((i) => i.title)).not.toContain('Private 1');
  });

  it('pages with a cursor without repeating or skipping an item', async () => {
    const { client, userId } = await newMember();
    await give(userId, 5);

    const first = await client.get<NotificationsPage>('/api/v1/me/notifications?limit=2');
    expect(first.body.items).toHaveLength(2);
    expect(first.body.nextCursor).not.toBeNull();

    const second = await client.get<NotificationsPage>(
      `/api/v1/me/notifications?limit=2&cursor=${encodeURIComponent(first.body.nextCursor!)}`,
    );
    expect(second.body.items).toHaveLength(2);

    const seen = [...first.body.items, ...second.body.items].map((i) => i.title);
    expect(new Set(seen).size).toBe(4);
    expect(seen).toEqual(['Notice 5', 'Notice 4', 'Notice 3', 'Notice 2']);
  });

  it('rejects a malformed cursor', async () => {
    const { client } = await newMember();
    const response = await client.get('/api/v1/me/notifications?cursor=not-a-cursor');
    expect(response.status).toBe(400);
  });

  it('filters to unread only', async () => {
    const { client, userId } = await newMember();
    await give(userId, 2);
    const all = await client.get<NotificationsPage>('/api/v1/me/notifications');
    const first = all.body.items[0]!;
    await client.post('/api/v1/me/notifications/read', { ids: [first.id] });

    const unread = await client.get<NotificationsPage>('/api/v1/me/notifications?unreadOnly=true');

    expect(unread.body.items.map((i) => i.id)).not.toContain(first.id);
    expect(unread.body.unread).toBe(1);
  });
});

describe('POST /me/notifications/read', () => {
  it('marks the named notifications read and returns the new count', async () => {
    const { client, userId } = await newMember();
    await give(userId, 3);
    const page = await client.get<NotificationsPage>('/api/v1/me/notifications');
    const ids = page.body.items.slice(0, 2).map((i) => i.id);

    const response = await client.post<NotificationsUnread>('/api/v1/me/notifications/read', {
      ids,
    });

    expect(response.status).toBe(200);
    expect(response.body.unread).toBe(1);
  });

  it('marks everything read', async () => {
    const { client, userId } = await newMember();
    await give(userId, 4);

    const response = await client.post<NotificationsUnread>('/api/v1/me/notifications/read', {
      all: true,
    });

    expect(response.status).toBe(200);
    expect(response.body.unread).toBe(0);
  });

  it("cannot mark another person's notification read", async () => {
    const mine = await newMember();
    const theirs = await newMember();
    await give(theirs.userId, 1, 'Theirs');
    const theirPage = await theirs.client.get<NotificationsPage>('/api/v1/me/notifications');
    const theirId = theirPage.body.items[0]!.id;

    await mine.client.post('/api/v1/me/notifications/read', { ids: [theirId] });

    const after = await theirs.client.get<NotificationsPage>('/api/v1/me/notifications');
    expect(after.body.unread).toBe(1);
    expect(after.body.items[0]?.readAt).toBeNull();
  });

  it('rejects a body that names neither ids nor all', async () => {
    const { client } = await newMember();
    for (const body of [{}, { ids: [], all: false }, { ids: ['not-a-uuid'] }]) {
      const response = await client.post('/api/v1/me/notifications/read', body);
      expect(response.status, JSON.stringify(body)).toBe(400);
    }
  });
});

describe('GET /me/notifications/unread', () => {
  it('returns just the count', async () => {
    const { client, userId } = await newMember();
    await give(userId, 2);
    const response = await client.get<NotificationsUnread>('/api/v1/me/notifications/unread');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ unread: 2 });
  });
});
