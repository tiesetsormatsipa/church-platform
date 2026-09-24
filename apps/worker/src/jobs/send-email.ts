/**
 * Sends one transactional e-mail and records the attempt in `email_deliveries`.
 *
 * Idempotency: the delivery row is keyed by the BullMQ job id, so a retry after a crash
 * that happened *between* the send and the bookkeeping finds a row already marked SENT and
 * does not send a second copy.
 */
import { JOBS, type JobPayload } from '@church/shared';
import { renderEmail } from '../email/templates.js';
import type { JobContext } from '../runtime.js';

export const sendEmailSchema = JOBS.sendEmail.schema;

export async function sendEmail(
  context: JobContext,
  payload: JobPayload<'sendEmail'>,
): Promise<void> {
  const { db, mail, logger } = context;
  const organization = await context.organization();
  const rendered = renderEmail(payload.message, { churchName: organization.name });
  const deliveryKey = context.jobKey;

  const existing = await db.emailDelivery.findUnique({
    where: { jobKey: deliveryKey },
    select: { id: true, status: true, attempts: true },
  });
  if (existing?.status === 'SENT') {
    logger.info({ template: payload.message.template }, 'E-mail already sent; skipping retry');
    return;
  }

  const delivery = await db.emailDelivery.upsert({
    where: { jobKey: deliveryKey },
    create: {
      jobKey: deliveryKey,
      userId: payload.userId,
      toEmail: payload.message.to,
      template: payload.message.template,
      subject: rendered.subject,
      status: 'QUEUED',
      provider: mail.name,
      attempts: 1,
    },
    update: { attempts: { increment: 1 }, provider: mail.name },
    select: { id: true },
  });

  try {
    const result = await mail.send({
      to: payload.message.to,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      ...(organization.email ? { replyTo: organization.email } : {}),
      // Lets mail clients group a thread and helps us trace a complaint back to a job.
      headers: { 'X-Church-Template': payload.message.template },
    });
    await db.emailDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        providerMessageId: result.providerMessageId,
        lastError: null,
      },
    });
    // Never log the address, the body or any token: only what is needed to trace delivery.
    logger.info({ template: payload.message.template, deliveryId: delivery.id }, 'E-mail sent');
  } catch (error) {
    await db.emailDelivery.update({
      where: { id: delivery.id },
      data: { status: 'FAILED', lastError: describeError(error) },
    });
    throw error;
  }
}

/** A short, safe error description for the delivery row (never the whole message body). */
function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 1000);
}
