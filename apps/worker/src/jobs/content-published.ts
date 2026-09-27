/**
 * Content became visible: tell the people it is for.
 *
 * Church-wide content goes to everyone with an account; branch content to that branch's
 * active members. The category follows the content type, so someone who has switched off
 * "Sermons" hears nothing about a new sermon.
 */
import {
  CONTENT_TYPE_NOTIFICATION_CATEGORY,
  CacheTags,
  contentPath,
  type JobPayload,
} from '@church/shared';
import { allMembers, branchMembers, oneUser } from '../notifications/recipients.js';
import { deliver } from '../notifications/deliver.js';
import type { JobContext } from '../runtime.js';

export async function contentPublished(
  context: JobContext,
  payload: JobPayload<'contentPublished'>,
): Promise<void> {
  const item = await context.db.contentItem.findFirst({
    where: { id: payload.contentId, deletedAt: null },
    select: {
      id: true,
      type: true,
      scope: true,
      branchId: true,
      slug: true,
      title: true,
      summary: true,
      status: true,
      publishedAt: true,
      authorId: true,
      branch: { select: { name: true } },
    },
  });

  // Unpublished or deleted again between the enqueue and now: nothing to announce.
  if (!item || item.status !== 'PUBLISHED' || !item.publishedAt || item.publishedAt > new Date()) {
    context.logger.info({ contentId: payload.contentId }, 'Content is not visible; skipping');
    return;
  }

  const recipients =
    item.scope === 'BRANCH' && item.branchId
      ? await branchMembers(context.db, item.branchId)
      : await allMembers(context.db);

  const branchName = item.scope === 'BRANCH' ? item.branch?.name : null;
  const result = await deliver(context, recipients, {
    category: CONTENT_TYPE_NOTIFICATION_CATEGORY[item.type],
    title: branchName ? `${item.title} (${branchName})` : item.title,
    body: item.summary,
    path: contentPath(item.type, item.slug),
    dedupeKey: `content-published:${item.id}`,
  });

  // A job posting was written by a member and held back until someone read it, so that
  // member deserves to be told the answer rather than watching the board for it.
  if (item.type === 'JOB' && item.authorId) {
    const author = await oneUser(context.db, item.authorId);
    await deliver(
      context,
      author,
      {
        category: 'ACCOUNT',
        title: 'Your job posting is on the board',
        body: item.title,
        path: contentPath(item.type, item.slug),
        // An edit clears publishedAt, so the next approval is a new event and says so again.
        dedupeKey: `job-approved:${item.id}:${item.publishedAt.toISOString()}`,
      },
      // ACCOUNT is normally e-mailed whatever the member chose, because it carries security
      // notices. This is good news about their own posting, not a security notice, so it
      // stays in the app rather than forcing mail on someone who posts often.
      { skipEmail: true },
    );
  }

  context.logger.info(
    { contentId: item.id, recipients: recipients.length, ...result },
    'Content publication announced',
  );

  // The listing pages cache by tag; refresh them so the item appears without waiting.
  await context.jobs.enqueue('revalidateWeb', {
    tags: [CacheTags.content, CacheTags.contentItem(item.slug)],
    ...(payload.requestId ? { requestId: payload.requestId } : {}),
  });
}
