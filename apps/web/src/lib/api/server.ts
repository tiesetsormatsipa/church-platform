import 'server-only';
import { createApiClient } from '@church/api-client';
import { CacheTags } from '@church/shared';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { serverEnv } from '../env';

/** Error for failed API calls during rendering (shown by the nearest error boundary). */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

interface CacheOptions {
  /** Seconds before cached data is refreshed (default 60). */
  revalidate?: number;
  tags?: string[];
}

const publicClient = createApiClient({ baseUrl: serverEnv.apiInternalUrl });

/**
 * Anonymous, cacheable read (Next data cache). Never forwards cookies, so responses can be
 * shared between visitors. Marks the render as request-time, so nothing is fetched at
 * build time (the API is not available then).
 */
export async function publicApi(options: CacheOptions = {}) {
  await connection();
  const init = { next: { revalidate: options.revalidate ?? 60, tags: options.tags ?? [CacheTags.content] } };
  return {
    client: publicClient,
    fetch: (request: Request) => fetch(request, init),
  };
}

/** Read on behalf of the signed-in visitor (forwards the session cookie; never cached). */
export async function userApi() {
  const incoming = await headers();
  const forward: Record<string, string> = {};
  const cookie = incoming.get('cookie');
  if (cookie) forward.cookie = cookie;
  const requestId = incoming.get('x-request-id');
  if (requestId) forward['x-request-id'] = requestId;
  return createApiClient({
    baseUrl: serverEnv.apiInternalUrl,
    headers: forward,
    fetch: (request: Request) => fetch(request, { cache: 'no-store' }),
  });
}

interface ApiResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

/** Return the data, call `notFound()` on 404, and throw on any other failure. */
export function unwrap<T>(result: ApiResult<T>): T {
  if (result.response.status === 404) notFound();
  if (result.data === undefined || result.error) {
    const error = result.error as { code?: string; detail?: string } | undefined;
    throw new ApiRequestError(
      result.response.status,
      error?.code,
      error?.detail ?? `The API responded with ${result.response.status}`,
    );
  }
  return result.data;
}
