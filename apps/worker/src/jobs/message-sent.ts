/**
 * Tell the other people in a conversation that something was said.
 *
 * The notification deliberately carries no part of the message. What one member writes to
 * another is private, and an e-mail sits on mail servers for years; "Grace wrote to you" and
 * a link is enough to bring someone back to read it in the place they chose to read it.
 */
import type { JobPayload } from '@church/shared';
import { deliver } from '../notifications/deliver.js';
import { theseUsers } from '../notifications/recipients.js';
import type { JobContext } from '../runtime.js';

export async function messageSent(
  context: JobContext,
  payload: JobPayload<'messageSent'>,
): Promise<void> {
  const message = await context.db.message.findUnique({
    where: { id: payload.messageId },
    select: {
      id: true,
      senderId: true,
      deletedAt: true,
      conversationId: true,
      sender: { select: { profile: { select: { firstName: true, displayName: true } } } },
      conversation: {
        select: {
          id: true,
          subject: true,
          deletedAt: true,
          participants: { where: { leftAt: null }, select: { userId: true } },
        },
      },
    },
  });

  // Withdrawn between the enqueue and now, which retries make possible.
  if (!message || message.deletedAt || message.conversation.deletedAt) {
    context.logger.info({ messageId: payload.messageId }, 'Message is no longer deliverable');
    return;
  }

  const audience = message.conversation.participants
    .map((p) => p.userId)
    .filter((id) => id !== message.senderId);
  const recipients = await theseUsers(context.db, audience);

  const profile = message.sender?.profile;
  const name = profile?.displayName?.trim() || profile?.firstName?.trim() || 'A member';
  const subject = message.conversation.subject;

  const result = await deliver(context, recipients, {
    category: 'MESSAGES',
    title: subject ? `${name} wrote about ${subject}` : `${name} wrote to you`,
    body: 'Open the conversation to read it.',
    path: `/messages/${message.conversationId}`,
    dedupeKey: `message-sent:${message.id}`,
  });

  context.logger.info(
    { messageId: message.id, recipients: recipients.length, ...result },
    'Message announced',
  );
}
