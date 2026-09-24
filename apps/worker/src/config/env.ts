import { z } from 'zod';
import {
  envBoolean,
  envPort,
  envSecret,
  loadEnv,
  LogLevel,
  NodeEnv,
} from '@church/infrastructure/env';

export const WorkerEnv = z.object({
  NODE_ENV: NodeEnv,

  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'must be a postgres:// URL'),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(5),
  REDIS_URL: z.string().regex(/^rediss?:\/\//, 'must be a redis:// URL'),

  ORGANIZATION_SLUG: z.string().min(1).default('first-church'),
  /** Public origin of the web app: links in e-mails and notifications point here. */
  APP_ORIGIN: z.url(),
  /** Where the worker reaches the web server to revalidate cached pages. */
  WEB_INTERNAL_URL: z.url().default('http://localhost:3000'),
  /** Shared with the web app's /internal/revalidate route. */
  REVALIDATE_SECRET: envSecret(32),

  /** `smtp` sends real messages; `memory` discards them (tests and dry runs). */
  MAIL_PROVIDER: z.enum(['smtp', 'memory']).default('smtp'),
  SMTP_HOST: z.string().min(1).default('localhost'),
  SMTP_PORT: envPort(1025),
  SMTP_SECURE: envBoolean(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().min(3).default('Church Platform <no-reply@example.org>'),

  /** Jobs processed at once per queue. */
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(100).default(5),
  /** Port for the worker's `/health` endpoint (the worker has no other HTTP surface). */
  WORKER_HEALTH_PORT: envPort(4100),

  LOG_LEVEL: LogLevel,
  LOG_PRETTY: envBoolean(false),
});
export type WorkerEnv = z.infer<typeof WorkerEnv>;

export interface WorkerConfig {
  env: WorkerEnv;
  isProduction: boolean;
  /** Origin without a trailing slash, for building links. */
  appOrigin: string;
  webInternalUrl: string;
}

export function buildWorkerConfig(
  source: Record<string, string | undefined> = process.env,
): WorkerConfig {
  const env = loadEnv(WorkerEnv, source);
  return {
    env,
    isProduction: env.NODE_ENV === 'production',
    appOrigin: new URL(env.APP_ORIGIN).origin,
    webInternalUrl: env.WEB_INTERNAL_URL.replace(/\/$/, ''),
  };
}
