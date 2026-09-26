import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createWorkerTestContext, type WorkerTestContext } from '../test/harness.js';
import { messageSent } from './message-sent.js';

let ctx: WorkerTestContext;
let organizationId: string;

beforeAll(async () => {
  ctx = await createWorkerTestContext();
  organizationId = (await ctx.context.organization()).id;
});

afterAll(async () => {
  await ctx?.close();
});

beforeEach(async () => {
  await ctx.context.jobs.queue('email').drain(true);
});

let counter = 0;
const unique = () => `${Date.now().toString(36)}-${(counter += 1)}`;

async function member(firstName: string) {
  return ctx.db.user.create({
    data: {
      email: `talker-${unique()}@example.org`,
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      profile: { create: { firstName, lastName: 'Ndlovu' } },
    },
    select: { id: true, email: true },
  });
}

/** A thread between the given people, with one message from the first of them. */
async function conversationWith(userIds: string[], body = 'Are you coming on Sunday?') {
  const [senderId, ...rest] = userIds;
  if (!senderId) throw new Error('A conversation needs a sender');
  const conversation = await ctx.db.conversation.create({
    data: {
      organizationId,
      context: 'PERSONAL',
      directKey: unique(),
      createdById: senderId,
      participants: { create: userIds.map((userId) => ({ userId })) },
    },
    select: { id: true },
  });
  const message = await ctx.db.message.create({
    data: { conversationId: conversation.id, senderId, body },
    select: { id: true },
  });
  return { conversationId: conversation.id, messageId: message.id, senderId, others: rest };
}

async function notificationsFor(userId: string) {
  return ctx.db.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
}

describe('messageSent', () => {
  it('tells the other person, and not the one who wrote', async () => {
    const grace = await member('Grace');
    const sipho = await member('Sipho');
    const thread = await conversationWith([grace.id, sipho.id]);

    await messageSent(ctx.job(), { messageId: thread.messageId });

    const rows = await notificationsFor(sipho.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      category: 'MESSAGES',
      title: 'Grace wrote to you',
      url: `/messages/${thread.conversationId}`,
      dedupeKey: `message-sent:${thread.messageId}`,
      readAt: null,
    });
    expect(await notificationsFor(grace.id)).toHaveLength(0);
  });

  it('never carries what was written', async () => {
    const grace = await member('Grace');
    const sipho = await member('Sipho');
    const secret = 'Please pray for my mother, she is in hospital.';
    const thread = await conversationWith([grace.id, sipho.id], secret);

    await messageSent(ctx.job(), { messageId: thread.messageId });

    const [row] = await notificationsFor(sipho.id);
    expect(row?.title).not.toContain('hospital');
    expect(row?.body).not.toContain('hospital');

    const queued = await ctx.context.jobs.queue('email').getJobs(['waiting', 'delayed']);
    const forSipho = queued.filter(
      (j) => (j.data as { message: { to: string } }).message.to === sipho.email,
    );
    expect(JSON.stringify(forSipho)).not.toContain('hospital');
  });

  it('writes nothing a second time when the job is retried', async () => {
    const grace = await member('Grace');
    const sipho = await member('Sipho');
    const thread = await conversationWith([grace.id, sipho.id]);

    await messageSent(ctx.job(), { messageId: thread.messageId });
    await messageSent(ctx.job(), { messageId: thread.messageId });

    expect(await notificationsFor(sipho.id)).toHaveLength(1);
  });

  it('stays quiet about a message that has been withdrawn', async () => {
    const grace = await member('Grace');
    const sipho = await member('Sipho');
    const thread = await conversationWith([grace.id, sipho.id]);
    await ctx.db.message.update({
      where: { id: thread.messageId },
      data: { deletedAt: new Date() },
    });

    await messageSent(ctx.job(), { messageId: thread.messageId });

    expect(await notificationsFor(sipho.id)).toHaveLength(0);
  });

  it('skips anyone who has left the thread', async () => {
    const grace = await member('Grace');
    const sipho = await member('Sipho');
    const naledi = await member('Naledi');
    const thread = await conversationWith([grace.id, sipho.id, naledi.id]);
    await ctx.db.conversationParticipant.update({
      where: {
        conversationId_userId: { conversationId: thread.conversationId, userId: naledi.id },
      },
      data: { leftAt: new Date() },
    });

    await messageSent(ctx.job(), { messageId: thread.messageId });

    expect(await notificationsFor(sipho.id)).toHaveLength(1);
    expect(await notificationsFor(naledi.id)).toHaveLength(0);
  });

  it('does nothing at all for a message that is not there', async () => {
    await expect(
      messageSent(ctx.job(), { messageId: '00000000-0000-7000-8000-000000000000' }),
    ).resolves.toBeUndefined();
  });
});
