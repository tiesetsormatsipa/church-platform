import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EmailMessage } from '@church/shared';
import { createWorkerTestContext, type WorkerTestContext } from '../test/harness.js';
import { sendEmail } from './send-email.js';

let ctx: WorkerTestContext;

beforeAll(async () => {
  ctx = await createWorkerTestContext();
});

afterAll(async () => {
  await ctx?.close();
});

const message = (to: string) =>
  EmailMessage.parse({
    template: 'verify-email',
    to,
    data: { firstName: 'Wendy', verifyUrl: 'http://localhost:3000/verify-email?token=abc' },
  });

describe('sendEmail', () => {
  it('sends the message and records the delivery', async () => {
    const job = ctx.job('email:record-1');
    const before = ctx.mail.sent.length;

    await sendEmail(job, { message: message('record@example.org'), userId: null });

    expect(ctx.mail.sent).toHaveLength(before + 1);
    const sent = ctx.mail.sent.at(-1);
    expect(sent?.to).toBe('record@example.org');
    expect(sent?.subject).toContain('Test Church');
    expect(sent?.text).toContain('http://localhost:3000/verify-email?token=abc');
    expect(sent?.html).toContain('<!doctype html>');

    const delivery = await ctx.db.emailDelivery.findUnique({
      where: { jobKey: 'email:record-1' },
    });
    expect(delivery).toMatchObject({
      toEmail: 'record@example.org',
      template: 'verify-email',
      status: 'SENT',
      provider: 'memory',
      attempts: 1,
      lastError: null,
    });
    expect(delivery?.sentAt).toBeInstanceOf(Date);
    expect(delivery?.providerMessageId).not.toBeNull();
  });

  it('does not send a second copy when the same job runs again', async () => {
    const payload = { message: message('once@example.org'), userId: null };
    await sendEmail(ctx.job('email:once'), payload);
    const after = ctx.mail.sent.length;

    // A retry of the *same* job, e.g. after the process died before acknowledging.
    await sendEmail(ctx.job('email:once'), payload);

    expect(ctx.mail.sent).toHaveLength(after);
    const deliveries = await ctx.db.emailDelivery.findMany({
      where: { toEmail: 'once@example.org' },
    });
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]?.attempts).toBe(1);
  });

  it('records the failure and rethrows so BullMQ retries', async () => {
    const failing = {
      ...ctx.job('email:failing'),
      mail: {
        name: 'failing',
        send: () => Promise.reject(new Error('smtp refused the connection')),
      },
    };

    await expect(
      sendEmail(failing, { message: message('fail@example.org'), userId: null }),
    ).rejects.toThrow('smtp refused');

    const delivery = await ctx.db.emailDelivery.findUnique({ where: { jobKey: 'email:failing' } });
    expect(delivery).toMatchObject({ status: 'FAILED', attempts: 1 });
    expect(delivery?.lastError).toContain('smtp refused');
    expect(delivery?.sentAt).toBeNull();
  });

  it('counts attempts and succeeds on a later try after a failure', async () => {
    const payload = { message: message('retry@example.org'), userId: null };
    const failing = {
      ...ctx.job('email:retry'),
      mail: { name: 'failing', send: () => Promise.reject(new Error('temporary')) },
    };
    await expect(sendEmail(failing, payload)).rejects.toThrow('temporary');

    await sendEmail(ctx.job('email:retry'), payload);

    const delivery = await ctx.db.emailDelivery.findUnique({ where: { jobKey: 'email:retry' } });
    expect(delivery).toMatchObject({ status: 'SENT', attempts: 2, lastError: null });
  });

  it('links the delivery to the user when the job names one', async () => {
    const user = await ctx.db.user.create({
      data: { email: `linked-${Date.now()}@example.org`, status: 'ACTIVE' },
      select: { id: true, email: true },
    });
    await sendEmail(ctx.job('email:linked'), {
      message: message(user.email),
      userId: user.id,
    });
    const delivery = await ctx.db.emailDelivery.findUnique({ where: { jobKey: 'email:linked' } });
    expect(delivery?.userId).toBe(user.id);
  });
});
