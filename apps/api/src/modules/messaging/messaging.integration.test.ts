import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  ConversationList,
  DirectoryList,
  MessageResult,
  MessagesPage,
  UnreadMessages,
} from '@church/shared';
import { DEMO_PASSWORD, DEMO_USERS } from '@church/database/seed';
import {
  createTestContext,
  signIn,
  signUpVerified,
  TestClient,
  type TestContext,
} from '../../test/harness.js';
import { ensureDemoData } from '../../test/demo.js';

let ctx: TestContext;
/** Grace Dlamini, an active member of Johannesburg. */
let grace: TestClient;
/** Sipho Nkosi, the Johannesburg administrator, and so also at Johannesburg. */
let sipho: TestClient;
/** Anele Jacobs, an editor at Cape Town: another branch entirely. */
let anele: TestClient;
let graceId: string;
let siphoId: string;
let aneleId: string;

async function userIdOf(email: string) {
  const user = await ctx.db.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
  return user.id;
}

beforeAll(async () => {
  ctx = await createTestContext();
  await ensureDemoData(ctx.db);

  grace = new TestClient(ctx.app);
  await signIn(grace, DEMO_USERS.member, DEMO_PASSWORD);
  sipho = new TestClient(ctx.app);
  await signIn(sipho, DEMO_USERS.johannesburgAdmin, DEMO_PASSWORD);
  anele = new TestClient(ctx.app);
  await signIn(anele, DEMO_USERS.capeTownEditor, DEMO_PASSWORD);

  graceId = await userIdOf(DEMO_USERS.member);
  siphoId = await userIdOf(DEMO_USERS.johannesburgAdmin);
  aneleId = await userIdOf(DEMO_USERS.capeTownEditor);
});

afterAll(async () => {
  await ctx?.db.conversation.deleteMany({
    where: { participants: { some: { userId: { in: [graceId, siphoId, aneleId] } } } },
  });
  await ctx?.close();
});

describe('who you may write to', () => {
  it('lists the members of your own branch, and not yourself', async () => {
    const response = await grace.get<DirectoryList>('/api/v1/me/messages/directory');
    expect(response.status).toBe(200);
    const ids = response.body.items.map((p) => p.id);
    expect(ids).toContain(siphoId);
    expect(ids).not.toContain(graceId);
    // Cape Town is somebody else's branch.
    expect(ids).not.toContain(aneleId);
  });

  it('gives a name and a picture, and never an address or a telephone number', async () => {
    const response = await grace.get<DirectoryList>('/api/v1/me/messages/directory');
    const person = response.body.items.find((p) => p.id === siphoId);
    expect(person?.displayName).toBeTruthy();
    expect(Object.keys(person ?? {}).sort()).toEqual([
      'avatarUrl',
      'branchName',
      'displayName',
      'id',
    ]);
  });

  it('narrows to a search', async () => {
    const response = await grace.get<DirectoryList>('/api/v1/me/messages/directory?q=zzzznobody');
    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
  });

  it('refuses someone who worships at another branch', async () => {
    const response = await grace.post('/api/v1/me/messages', {
      userId: aneleId,
      body: 'Hello from another branch.',
    });
    expect(response.status).toBe(403);
  });

  it('refuses writing to yourself', async () => {
    const response = await grace.post('/api/v1/me/messages', {
      userId: graceId,
      body: 'Talking to myself.',
    });
    expect(response.status).toBe(400);
  });

  it('refuses an empty message', async () => {
    const response = await grace.post('/api/v1/me/messages', { userId: siphoId, body: '   ' });
    expect(response.status).toBe(400);
  });

  it('turns away someone who is not signed in', async () => {
    const stranger = new TestClient(ctx.app);
    const response = await stranger.get('/api/v1/me/messages');
    expect(response.status).toBe(401);
  });
});

describe('a conversation between two members', () => {
  let conversationId: string;

  it('starts when the first message is sent', async () => {
    const response = await grace.post<MessageResult>('/api/v1/me/messages', {
      userId: siphoId,
      body: 'Good evening, is the choir practising on Thursday?',
    });
    expect(response.status).toBe(201);
    expect(response.body.message.mine).toBe(true);
    conversationId = response.body.conversationId;
  });

  it('does not start a second thread with the same person', async () => {
    const again = await grace.post<MessageResult>('/api/v1/me/messages', {
      userId: siphoId,
      body: 'Or is it Friday?',
    });
    expect(again.status).toBe(201);
    expect(again.body.conversationId).toBe(conversationId);
  });

  it('reaches the other person, who sees it unread', async () => {
    const inbox = await sipho.get<ConversationList>('/api/v1/me/messages');
    expect(inbox.status).toBe(200);
    const thread = inbox.body.items.find((c) => c.id === conversationId);
    expect(thread).toBeDefined();
    expect(thread?.unread).toBe(2);
    expect(thread?.others.map((p) => p.id)).toEqual([graceId]);
    expect(thread?.lastMessage?.mine).toBe(false);

    const unread = await sipho.get<UnreadMessages>('/api/v1/me/messages/unread');
    expect(unread.body.unread).toBeGreaterThanOrEqual(2);
  });

  it('does not count the sender’s own messages as unread', async () => {
    const inbox = await grace.get<ConversationList>('/api/v1/me/messages');
    expect(inbox.body.items.find((c) => c.id === conversationId)?.unread).toBe(0);
  });

  it('reads oldest first', async () => {
    const page = await sipho.get<MessagesPage>(`/api/v1/me/messages/${conversationId}`);
    expect(page.status).toBe(200);
    expect(page.body.items).toHaveLength(2);
    expect(page.body.items[0]?.body).toContain('Thursday');
    expect(page.body.items[1]?.body).toContain('Friday');
    expect(page.body.items[0]?.mine).toBe(false);
    expect(page.body.items[0]?.sender?.id).toBe(graceId);
  });

  it('clears the unread count when it is marked read', async () => {
    const marked = await sipho.post(`/api/v1/me/messages/${conversationId}/read`, {});
    expect(marked.status).toBe(204);
    const unread = await sipho.get<UnreadMessages>('/api/v1/me/messages/unread');
    expect(unread.body.unread).toBe(0);
  });

  it('lets the other person reply in the same thread', async () => {
    const reply = await sipho.post<MessageResult>(
      `/api/v1/me/messages/${conversationId}/messages`,
      { body: 'Thursday, at six.' },
    );
    expect(reply.status).toBe(201);
    expect(reply.body.conversationId).toBe(conversationId);

    const inbox = await grace.get<ConversationList>('/api/v1/me/messages');
    expect(inbox.body.items.find((c) => c.id === conversationId)?.unread).toBe(1);
  });

  it('finds a thread by what was said in it', async () => {
    const found = await grace.get<ConversationList>('/api/v1/me/messages?q=choir');
    expect(found.body.items.map((c) => c.id)).toContain(conversationId);

    const missed = await grace.get<ConversationList>('/api/v1/me/messages?q=zzzznothing');
    expect(missed.body.items.map((c) => c.id)).not.toContain(conversationId);
  });

  it('hides the thread from everyone who is not in it', async () => {
    const list = await anele.get<ConversationList>('/api/v1/me/messages');
    expect(list.body.items.map((c) => c.id)).not.toContain(conversationId);

    // Not 403: a thread you are not in should not even be known to exist.
    const peek = await anele.get(`/api/v1/me/messages/${conversationId}`);
    expect(peek.status).toBe(404);

    const interject = await anele.post(`/api/v1/me/messages/${conversationId}/messages`, {
      body: 'Listening in.',
    });
    expect(interject.status).toBe(404);
  });
});

describe('a member whose address is not confirmed', () => {
  it('cannot sign in, so messaging is out of reach', async () => {
    const client = new TestClient(ctx.app);
    const email = `unverified-${Date.now().toString(36)}@example.org`;
    const registered = await client.post('/api/v1/auth/register', {
      email,
      password: DEMO_PASSWORD,
      firstName: 'Un',
      lastName: 'Verified',
      acceptTerms: true,
    });
    expect(registered.status).toBe(202);

    const signedIn = await client.post('/api/v1/auth/login', { email, password: DEMO_PASSWORD });
    expect(signedIn.status).toBe(403);

    await ctx.db.user.deleteMany({ where: { email } });
  });

  it('loses messaging if the confirmation is withdrawn mid-session', async () => {
    const client = new TestClient(ctx.app);
    const email = await signUpVerified(ctx, client);
    expect((await client.get('/api/v1/me/messages')).status).toBe(200);

    // What an administrator does when an address turns out to be wrong.
    await ctx.db.user.update({ where: { email }, data: { emailVerifiedAt: null } });

    expect((await client.get('/api/v1/me/messages')).status).toBe(403);
    await ctx.db.user.deleteMany({ where: { email } });
  });
});

describe('paging a long thread', () => {
  it('walks backwards through the older messages', async () => {
    const guest = new TestClient(ctx.app);
    const email = await signUpVerified(ctx, guest);
    const guestId = await userIdOf(email);
    // Put the new account in Johannesburg so Grace may write to it.
    const branch = await ctx.db.branch.findFirstOrThrow({
      where: { slug: 'johannesburg' },
      select: { id: true },
    });
    await ctx.db.branchMembership.create({
      data: { userId: guestId, branchId: branch.id, status: 'ACTIVE', isPrimary: false },
    });

    const first = await grace.post<MessageResult>('/api/v1/me/messages', {
      userId: guestId,
      body: 'Message 1',
    });
    expect(first.status).toBe(201);
    const conversationId = first.body.conversationId;
    for (let n = 2; n <= 5; n += 1) {
      const sent = await grace.post(`/api/v1/me/messages/${conversationId}/messages`, {
        body: `Message ${n}`,
      });
      expect(sent.status).toBe(201);
    }

    const page = await grace.get<MessagesPage>(`/api/v1/me/messages/${conversationId}?limit=2`);
    expect(page.body.items.map((m) => m.body)).toEqual(['Message 4', 'Message 5']);
    expect(page.body.olderCursor).toBeTruthy();

    const older = await grace.get<MessagesPage>(
      `/api/v1/me/messages/${conversationId}?limit=2&before=${encodeURIComponent(page.body.olderCursor!)}`,
    );
    expect(older.body.items.map((m) => m.body)).toEqual(['Message 2', 'Message 3']);

    const oldest = await grace.get<MessagesPage>(
      `/api/v1/me/messages/${conversationId}?limit=2&before=${encodeURIComponent(older.body.olderCursor!)}`,
    );
    expect(oldest.body.items.map((m) => m.body)).toEqual(['Message 1']);
    expect(oldest.body.olderCursor).toBeNull();

    await ctx.db.conversation.deleteMany({ where: { id: conversationId } });
    await ctx.db.user.deleteMany({ where: { id: guestId } });
  });

  it('refuses a cursor that is not one of ours', async () => {
    const list = await grace.get<ConversationList>('/api/v1/me/messages');
    const id = list.body.items[0]?.id;
    expect(id).toBeTruthy();
    const response = await grace.get(`/api/v1/me/messages/${id}?before=not-a-cursor`);
    expect(response.status).toBe(400);
  });
});
