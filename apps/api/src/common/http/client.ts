import { createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import type { FastifyRequest } from 'fastify';

/** Header carrying the shared secret of trusted internal callers (the web server). */
export const INTERNAL_TOKEN_HEADER = 'x-internal-token';
/** Header in which a trusted caller names the visitor it is calling on behalf of. */
export const CLIENT_IP_HEADER = 'x-client-ip';

export interface RequestClient {
  /** Visitor IP used for rate limiting and audit, or null for internal calls without one. */
  ip: string | null;
  /** True when the request carries the internal token (server-side rendering). */
  internal: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    client?: RequestClient;
  }
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

/**
 * Work out who a request is for. Server-side rendering reaches the API from the web server,
 * so its address says nothing about the visitor; with the internal token, the web server
 * may name the visitor's IP instead. Without a valid token the header is ignored.
 */
export function resolveClient(request: FastifyRequest, internalToken: string | undefined): RequestClient {
  const presented = request.headers[INTERNAL_TOKEN_HEADER];
  const internal =
    Boolean(internalToken) &&
    typeof presented === 'string' &&
    timingSafeEqual(digest(presented), digest(internalToken as string));
  if (!internal) return { ip: request.ip ?? null, internal: false };
  const forwarded = request.headers[CLIENT_IP_HEADER];
  const ip = typeof forwarded === 'string' && isIP(forwarded.trim()) ? forwarded.trim() : null;
  return { ip, internal: true };
}

/** The resolved client, computing it if the hook has not run (e.g. in unit tests). */
export function clientOf(request: FastifyRequest): RequestClient {
  return request.client ?? { ip: request.ip ?? null, internal: false };
}
