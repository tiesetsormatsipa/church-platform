import { createHash, timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { JOBS } from '@church/shared';
import { serverEnv } from '@/lib/env';

/**
 * Cache revalidation webhook for the worker (`revalidateWeb` jobs).
 *
 * It lives outside `/api` (which `next.config.ts` proxies to the API) and outside
 * `_internal` (which Next reserves). It is not linked anywhere and is refused without the
 * shared secret.
 *
 * `{ expire: 0 }` rather than the `'max'` profile: the next request must see fresh data,
 * because an administrator who publishes something expects to find it on the public page
 * straight away. `'max'` would serve stale content while revalidating in the background.
 * `updateTag`, which has the semantics we want, is only callable from Server Actions, and
 * domain mutations here do not use those (ADR-021). See ADR-026.
 */

const RevalidateRequest = JOBS.revalidateWeb.schema;

/** Constant-time comparison over digests, so neither value nor length leaks through timing. */
function secretMatches(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

function bearer(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [scheme, ...rest] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer') return null;
  const token = rest.join(' ').trim();
  return token || null;
}

export async function POST(request: Request): Promise<Response> {
  const expected = serverEnv.revalidateSecret;
  if (!expected) {
    // Refuse rather than accept anything: an unset secret is a misconfiguration.
    return new Response(null, { status: 503 });
  }

  const token = bearer(request);
  if (!token || !secretMatches(token, expected)) {
    return new Response(null, { status: 401 });
  }

  const parsed = RevalidateRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }

  for (const tag of parsed.data.tags) revalidateTag(tag, { expire: 0 });

  return new Response(null, { status: 204 });
}
