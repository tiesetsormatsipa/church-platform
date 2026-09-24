/**
 * A baptism enquiry arrived: tell the people who follow them up for that branch, and
 * confirm to the enquirer that it was received.
 *
 * The enquirer may have no account at all (the form is public), so their confirmation is a
 * plain e-mail rather than a notification.
 */
import type { JobPayload } from '@church/shared';
import { withPermission } from '../notifications/recipients.js';
import { deliver } from '../notifications/deliver.js';
import type { JobContext } from '../runtime.js';

export async function baptismRequestReceived(
  context: JobContext,
  payload: JobPayload<'baptismRequestReceived'>,
): Promise<void> {
  const request = await context.db.baptismRequest.findUnique({
    where: { id: payload.baptismRequestId },
    select: {
      id: true,
      fullName: true,
      email: true,
      branchId: true,
      branch: { select: { name: true } },
    },
  });
  if (!request) {
    context.logger.info({ id: payload.baptismRequestId }, 'Baptism enquiry no longer exists');
    return;
  }

  const organization = await context.organization();
  const managers = await withPermission(
    context.db,
    organization.id,
    'baptism_request.manage',
    request.branchId,
  );

  // The generic notification e-mail would omit the enquirer's name, so send the dedicated
  // template to managers instead and keep deliver() to the in-app row.
  const result = await deliver(
    context,
    managers,
    {
      category: 'BAPTISM',
      title: `New baptism enquiry for ${request.branch.name}`,
      body: `${request.fullName} would like to be baptised.`,
      path: '/admin/baptism',
      dedupeKey: `baptism-request:${request.id}`,
    },
    { skipEmail: true },
  );

  for (const manager of managers) {
    if (!manager.emailVerified) continue;
    await context.jobs.enqueue(
      'sendEmail',
      {
        message: {
          template: 'baptism-request-received',
          to: manager.email,
          data: {
            branchName: request.branch.name,
            fullName: request.fullName,
            manageUrl: context.link('/admin/baptism'),
          },
        },
        userId: manager.id,
      },
      { jobId: `br-${request.id}-${manager.id}` },
    );
  }

  await context.jobs.enqueue(
    'sendEmail',
    {
      message: {
        template: 'baptism-request-confirmation',
        to: request.email,
        data: { fullName: request.fullName, branchName: request.branch.name },
      },
      userId: null,
    },
    { jobId: `brc-${request.id}` },
  );

  context.logger.info(
    { id: request.id, managers: managers.length, created: result.created },
    'Baptism enquiry announced',
  );
}
