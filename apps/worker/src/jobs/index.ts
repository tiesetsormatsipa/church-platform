/**
 * The job registry. Adding a job means defining its contract in
 * `packages/shared/src/jobs.ts` and registering its handler here.
 */
import type { JobKey, JobPayload } from '@church/shared';
import type { HandlerRegistry, JobContext } from '../runtime.js';
import { contentPublished } from './content-published.js';
import { membershipDecided, membershipRequested } from './membership.js';
import { messageSent } from './message-sent.js';
import { revalidateWeb } from './revalidate-web.js';
import { sendEmail } from './send-email.js';

/** Pairs each handler with the payload type of the job it is registered under. */
type HandlerFor<K extends JobKey> = (context: JobContext, payload: JobPayload<K>) => Promise<void>;

function handler<K extends JobKey>(_key: K, fn: HandlerFor<K>): HandlerFor<K> {
  return fn;
}

export const HANDLERS: HandlerRegistry = {
  sendEmail: handler('sendEmail', sendEmail),
  revalidateWeb: handler('revalidateWeb', revalidateWeb),
  contentPublished: handler('contentPublished', contentPublished),
  membershipRequested: handler('membershipRequested', membershipRequested),
  membershipDecided: handler('membershipDecided', membershipDecided),
  messageSent: handler('messageSent', messageSent),
  // processMedia arrives with Phase 8; until then media jobs wait in their queue.
} as HandlerRegistry;
