/**
 * Branch membership events.
 *
 * `membershipRequested` reaches the people who review memberships for that branch;
 * `membershipDecided` reaches the member, in-app and by e-mail, because a decision about
 * one's own account should never be missed.
 */
import type { JobPayload } from '@church/shared';
import { oneUser, withPermission } from '../notifications/recipients.js';
import { deliver } from '../notifications/deliver.js';
import type { JobContext } from '../runtime.js';

const MEMBERSHIP_SELECT = {
  id: true,
  status: true,
  decisionNote: true,
  userId: true,
  branchId: true,
  branch: { select: { name: true } },
  user: { select: { email: true, profile: { select: { firstName: true } } } },
} as const;

export async function membershipRequested(
  context: JobContext,
  payload: JobPayload<'membershipRequested'>,
): Promise<void> {
  const membership = await context.db.branchMembership.findUnique({
    where: { id: payload.membershipId },
    select: MEMBERSHIP_SELECT,
  });
  if (!membership || membership.status !== 'PENDING') {
    context.logger.info({ membershipId: payload.membershipId }, 'Membership is not pending');
    return;
  }

  const organization = await context.organization();
  const reviewers = await withPermission(
    context.db,
    organization.id,
    'membership.review',
    membership.branchId,
  );
  const name = membership.user.profile?.firstName ?? 'Someone';

  const result = await deliver(context, reviewers, {
    category: 'MEMBERSHIP',
    title: `${name} asked to join ${membership.branch.name}`,
    body: 'Review the request in the administration area.',
    path: '/admin/memberships',
    dedupeKey: `membership-requested:${membership.id}`,
  });
  context.logger.info(
    { membershipId: membership.id, reviewers: reviewers.length, ...result },
    'Membership request announced',
  );
}

export async function membershipDecided(
  context: JobContext,
  payload: JobPayload<'membershipDecided'>,
): Promise<void> {
  const membership = await context.db.branchMembership.findUnique({
    where: { id: payload.membershipId },
    select: MEMBERSHIP_SELECT,
  });
  if (!membership || (membership.status !== 'ACTIVE' && membership.status !== 'REJECTED')) {
    context.logger.info({ membershipId: payload.membershipId }, 'Membership has no decision yet');
    return;
  }

  const approved = membership.status === 'ACTIVE';
  const branchName = membership.branch.name;
  const recipients = await oneUser(context.db, membership.userId);

  const result = await deliver(
    context,
    recipients,
    {
      category: 'MEMBERSHIP',
      title: approved
        ? `You have joined ${branchName}`
        : `Your request to join ${branchName} was not approved`,
      body: membership.decisionNote,
      path: '/profile',
      dedupeKey: `membership-decided:${membership.id}:${membership.status}`,
    },
    { skipEmail: true },
  );

  // The dedicated template says more than the generic notification e-mail, so it is sent
  // in addition to the in-app row rather than through deliver()'s e-mail channel.
  const recipient = recipients[0];
  if (recipient && recipient.emailVerified) {
    await context.jobs.enqueue(
      'sendEmail',
      {
        message: {
          template: 'membership-decided',
          to: recipient.email,
          data: {
            firstName: recipient.firstName,
            branchName,
            approved,
            note: membership.decisionNote,
          },
        },
        userId: recipient.id,
      },
      { jobId: `md-${membership.id}-${membership.status}` },
    );
  }

  context.logger.info(
    { membershipId: membership.id, approved, created: result.created },
    'Membership decision announced',
  );
}
