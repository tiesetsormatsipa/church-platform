/**
 * Everything a job handler needs. Built once at start-up and passed to every handler, so
 * handlers stay pure functions of (context, payload) and are easy to test.
 */
import { createPrismaClient, type DatabaseClient } from '@church/database';
import { JobProducer } from '@church/infrastructure/queue';
import {
  MemoryMailProvider,
  SmtpMailProvider,
  type MailProvider,
} from '@church/infrastructure/mail';
import { parseOrganizationSettings, type OrganizationSettings } from '@church/shared';
import type { Logger } from '@church/infrastructure/logger';
import type { Redis } from '@church/infrastructure/redis';
import type { WorkerConfig } from './config/env.js';

/** The organisation row, refreshed periodically (its name appears in every e-mail). */
export interface OrganizationSnapshot {
  id: string;
  name: string;
  shortName: string | null;
  email: string | null;
  settings: OrganizationSettings;
}

const ORGANIZATION_TTL_MS = 60_000;

export interface WorkerContext {
  config: WorkerConfig;
  db: DatabaseClient;
  redis: Redis;
  logger: Logger;
  mail: MailProvider;
  jobs: JobProducer;
  /** The organisation, cached for a minute. */
  organization(): Promise<OrganizationSnapshot>;
  /** Absolute URL on the public site for an app-relative path. */
  link(path: string): string;
}

export function createMailProvider(config: WorkerConfig): MailProvider {
  if (config.env.MAIL_PROVIDER === 'memory') return new MemoryMailProvider();
  return new SmtpMailProvider({
    host: config.env.SMTP_HOST,
    port: config.env.SMTP_PORT,
    secure: config.env.SMTP_SECURE,
    ...(config.env.SMTP_USER ? { user: config.env.SMTP_USER } : {}),
    ...(config.env.SMTP_PASSWORD ? { password: config.env.SMTP_PASSWORD } : {}),
    from: config.env.MAIL_FROM,
  });
}

export interface CreateContextOptions {
  config: WorkerConfig;
  redis: Redis;
  logger: Logger;
  db?: DatabaseClient;
  mail?: MailProvider;
}

export function createContext(options: CreateContextOptions): WorkerContext {
  const { config, redis, logger } = options;
  const db =
    options.db ??
    createPrismaClient({
      url: config.env.DATABASE_URL,
      poolMax: config.env.DATABASE_POOL_MAX,
      applicationName: 'church-worker',
    });
  const mail = options.mail ?? createMailProvider(config);
  const jobs = new JobProducer(redis);

  let cached: { at: number; value: OrganizationSnapshot } | null = null;

  return {
    config,
    db,
    redis,
    logger,
    mail,
    jobs,
    async organization() {
      const now = Date.now();
      if (cached && now - cached.at < ORGANIZATION_TTL_MS) return cached.value;
      const row = await db.organization.findUnique({
        where: { slug: config.env.ORGANIZATION_SLUG },
        select: { id: true, name: true, shortName: true, email: true, settings: true },
      });
      if (!row) throw new Error(`Organisation "${config.env.ORGANIZATION_SLUG}" not found`);
      const value: OrganizationSnapshot = {
        id: row.id,
        name: row.name,
        shortName: row.shortName,
        email: row.email,
        settings: parseOrganizationSettings(row.settings),
      };
      cached = { at: now, value };
      return value;
    },
    link(path: string) {
      return `${config.appOrigin}${path.startsWith('/') ? path : `/${path}`}`;
    },
  };
}
