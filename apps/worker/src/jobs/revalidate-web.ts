/**
 * Asks the web app to drop cached pages for a set of cache tags.
 *
 * The web app cannot be told from here which pages to rebuild: it owns its cache. So the
 * worker simply POSTs the tags to a secret-protected route that calls `revalidateTag`.
 */
import type { JobPayload } from '@church/shared';
import type { JobContext } from '../runtime.js';

/** Revalidation is cheap to repeat but should not hold a queue slot for long. */
const TIMEOUT_MS = 10_000;

export async function revalidateWeb(
  context: JobContext,
  payload: JobPayload<'revalidateWeb'>,
): Promise<void> {
  const url = `${context.config.webInternalUrl}/internal/revalidate`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${context.config.env.REVALIDATE_SECRET}`,
      ...(payload.requestId ? { 'x-request-id': payload.requestId } : {}),
    },
    body: JSON.stringify({ tags: payload.tags }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    // The body may repeat the request; keep only the status so no tag leaks into logs.
    throw new Error(`Cache revalidation failed with HTTP ${response.status}`);
  }
  context.logger.info({ tags: payload.tags.length }, 'Web cache revalidated');
}
