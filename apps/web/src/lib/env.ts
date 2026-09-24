import 'server-only';

/** Server-side configuration for the web app. Never import from Client Components. */
export const serverEnv = {
  /** Where the web server reaches the API (container network or localhost). */
  apiInternalUrl: (process.env.API_INTERNAL_URL ?? 'http://localhost:4000').replace(/\/$/, ''),
  /** Public origin of the site, used for canonical URLs and metadata. */
  appOrigin: (process.env.APP_ORIGIN ?? 'http://localhost:3000').replace(/\/$/, ''),
  /** Shared secret for the worker's cache revalidation calls. */
  revalidateSecret: process.env.REVALIDATE_SECRET ?? '',
};
