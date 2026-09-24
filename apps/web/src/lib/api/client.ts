'use client';

import { createApiClient } from '@church/api-client';
import { CSRF_HEADER, type ProblemDetails } from '@church/shared';

const CSRF_COOKIES = ['__Host-cp_csrf', 'cp_csrf'];

function readCookie(name: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

let pendingToken: Promise<string> | null = null;

/** The CSRF token for unsafe requests, fetched from the API if the cookie is missing. */
export async function csrfToken(): Promise<string> {
  for (const name of CSRF_COOKIES) {
    const value = readCookie(name);
    if (value) return decodeURIComponent(value);
  }
  pendingToken ??= fetch('/api/v1/auth/csrf', { credentials: 'same-origin' })
    .then((r) => r.json() as Promise<{ token: string }>)
    .then((body) => body.token)
    .finally(() => {
      pendingToken = null;
    });
  return pendingToken;
}

/**
 * Browser API client. Same-origin requests (Nginx or the dev rewrite route /api to the
 * API), so the session cookie is sent automatically; unsafe methods get the CSRF header.
 */
export const api = createApiClient({ baseUrl: '', credentials: 'same-origin' });

api.use({
  async onRequest({ request }) {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      request.headers.set(CSRF_HEADER, await csrfToken());
    }
    return request;
  },
});

/** Error raised from API problem details, with field errors for forms. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: { path: string; message: string }[];

  constructor(status: number, problem: Partial<ProblemDetails> | undefined) {
    super(problem?.detail ?? 'Something went wrong. Please try again.');
    this.name = 'ApiError';
    this.status = status;
    this.code = problem?.code ?? 'UNKNOWN';
    this.fieldErrors = problem?.errors ?? [];
  }
}

/** Throw an `ApiError` unless the call succeeded; return the data otherwise. */
export function ensureOk<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined || !result.response.ok) {
    throw new ApiError(result.response.status, result.error as Partial<ProblemDetails> | undefined);
  }
  return result.data as T;
}
