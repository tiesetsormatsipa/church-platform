/**
 * Typed client for the Church Platform API, generated from the OpenAPI document that the
 * API exports (`pnpm api:openapi`). Never edit `schema.d.ts` by hand.
 */
import createClient, { type ClientOptions } from 'openapi-fetch';
import type { components, paths } from './schema.js';

export type { components, paths };

export type ApiClient = ReturnType<typeof createClient<paths>>;

export function createApiClient(options: ClientOptions): ApiClient {
  return createClient<paths>(options);
}
