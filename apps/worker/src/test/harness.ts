/**
 * Builds a worker context against this run's throwaway database, with the in-memory mail
 * provider so tests can read what would have been sent.
 */
import { createPrismaClient, type DatabaseClient } from '@church/database';
import { createRedis, type Redis } from '@church/infrastructure/redis';
import { MemoryMailProvider } from '@church/infrastructure/mail';
import { createLogger } from '@church/infrastructure/logger';
import { buildWorkerConfig } from '../config/env.js';
import { createContext, type WorkerContext } from '../context.js';
import type { JobContext } from '../runtime.js';

export interface WorkerTestContext {
  context: WorkerContext;
  db: DatabaseClient;
  redis: Redis;
  mail: MemoryMailProvider;
  /** A job context with a unique key, as the runtime would build for one BullMQ job. */
  job(key?: string): JobContext;
  close(): Promise<void>;
}

let counter = 0;

export async function createWorkerTestContext(): Promise<WorkerTestContext> {
  const config = buildWorkerConfig();
  const db = createPrismaClient({ url: config.env.DATABASE_URL, poolMax: 2 });
  const redis = createRedis({ url: config.env.REDIS_URL, name: 'worker-test' });
  const mail = new MemoryMailProvider();
  const logger = createLogger({ name: 'worker-test', level: 'silent' });
  const context = createContext({ config, redis, logger, db, mail });

  return {
    context,
    db,
    redis,
    mail,
    job(key?: string) {
      counter += 1;
      return { ...context, jobKey: key ?? `test:${counter}`, attempt: 1 };
    },
    async close() {
      await context.jobs.close();
      await db.$disconnect();
      redis.disconnect();
    },
  };
}
