import { z } from 'zod';
import {
  envBoolean,
  envList,
  envPort,
  loadEnv,
  LogLevel,
  NodeEnv,
} from '@church/infrastructure/env';

export const ApiEnv = z.object({
  NODE_ENV: NodeEnv,
  HOST: z.string().default('0.0.0.0'),
  PORT: envPort(4000),
  /** Public origin of the web app (used in e-mail links and for CSRF origin checks). */
  APP_ORIGIN: z.url(),
  /** Extra origins allowed to make credentialed requests (e.g. a staging web app). */
  ALLOWED_ORIGINS: envList,
  /** Honour X-Forwarded-* from the reverse proxy (true behind Nginx). */
  TRUST_PROXY: envBoolean(false),

  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'must be a postgres:// URL'),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  REDIS_URL: z.string().regex(/^rediss?:\/\//, 'must be a redis:// URL'),

  ORGANIZATION_SLUG: z.string().min(1).default('first-church'),

  /** Secure (HTTPS-only) cookies with the __Host- prefix. Defaults to true in production. */
  COOKIE_SECURE: z.enum(['true', 'false', '1', '0']).optional(),

  S3_ENDPOINT: z.url().optional(),
  S3_PRESIGN_ENDPOINT: z.url().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().min(3),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: envBoolean(true),
  /** Base URL under which public media objects are served. */
  MEDIA_PUBLIC_BASE_URL: z.url(),
  /** Create the bucket and public-read policy at start-up (development convenience). */
  STORAGE_ENSURE_BUCKET: envBoolean(false),

  API_DOCS_ENABLED: z.enum(['true', 'false', '1', '0']).optional(),
  LOG_LEVEL: LogLevel,
  LOG_PRETTY: envBoolean(false),
});
export type ApiEnv = z.infer<typeof ApiEnv>;

export interface AppConfig {
  env: ApiEnv;
  isProduction: boolean;
  isTest: boolean;
  appOrigin: string;
  /** Origins accepted by the CSRF origin check and CORS. */
  trustedOrigins: string[];
  cookies: {
    secure: boolean;
    sessionName: string;
    csrfName: string;
  };
  session: {
    /** Sliding inactivity timeout. */
    idleTtlMs: number;
    /** Hard limit with "remember me". */
    rememberMeTtlMs: number;
    /** Hard limit without "remember me" (browser-session cookie). */
    shortTtlMs: number;
    /** Minimum interval between last-seen updates, to limit writes. */
    touchIntervalMs: number;
  };
  apiDocsEnabled: boolean;
}

const DAY = 24 * 60 * 60 * 1000;

function flag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
}

export function buildConfig(source: Record<string, string | undefined> = process.env): AppConfig {
  const env = loadEnv(ApiEnv, source);
  const isProduction = env.NODE_ENV === 'production';
  const secure = flag(env.COOKIE_SECURE, isProduction);
  const appOrigin = new URL(env.APP_ORIGIN).origin;
  return {
    env,
    isProduction,
    isTest: env.NODE_ENV === 'test',
    appOrigin,
    trustedOrigins: [appOrigin, ...env.ALLOWED_ORIGINS.map((o) => new URL(o).origin)],
    cookies: {
      secure,
      // The __Host- prefix requires Secure and binds the cookie to this exact host.
      sessionName: secure ? '__Host-cp_session' : 'cp_session',
      csrfName: secure ? '__Host-cp_csrf' : 'cp_csrf',
    },
    session: {
      idleTtlMs: 14 * DAY,
      rememberMeTtlMs: 60 * DAY,
      shortTtlMs: 1 * DAY,
      touchIntervalMs: 5 * 60 * 1000,
    },
    apiDocsEnabled: flag(env.API_DOCS_ENABLED, !isProduction),
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');
