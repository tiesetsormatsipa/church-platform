/**
 * Background worker: e-mail, cache revalidation and notification fan-out.
 *
 * A plain Node process rather than a Nest application (ADR-013): it needs Prisma, Redis and
 * mail, but no HTTP layer or DI graph.
 */
import { createLogger } from '@church/infrastructure/logger';
import { createRedis } from '@church/infrastructure/redis';
import { loadDotEnv, EnvValidationError } from '@church/infrastructure/env';
import { buildWorkerConfig } from './config/env.js';
import { createContext } from './context.js';
import { startWorkers } from './runtime.js';
import { startHealthServer } from './health.js';
import { HANDLERS } from './jobs/index.js';

async function main(): Promise<void> {
  loadDotEnv();
  const config = buildWorkerConfig();
  const logger = createLogger({
    name: 'worker',
    level: config.env.LOG_LEVEL,
    pretty: config.env.LOG_PRETTY,
  });

  // BullMQ blocks on Redis, which ioredis must not retry: maxRetriesPerRequest = null.
  const redis = createRedis({
    url: config.env.REDIS_URL,
    name: 'worker',
    maxRetriesPerRequest: null,
  });
  const context = createContext({ config, redis, logger });

  const workers = startWorkers({
    context,
    handlers: HANDLERS,
    concurrency: config.env.WORKER_CONCURRENCY,
    logger,
  });
  const health = startHealthServer({
    port: config.env.WORKER_HEALTH_PORT,
    db: context.db,
    redis,
    logger,
    queues: workers.map((worker) => worker.name),
  });

  logger.info(
    { queues: workers.length, mail: context.mail.name, env: config.env.NODE_ENV },
    'Worker started',
  );

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, 'Shutting down');
    health.close();
    // close() waits for jobs in flight, so a deploy never interrupts a send mid-flight.
    await Promise.allSettled(workers.map((worker) => worker.close()));
    await Promise.allSettled([
      context.jobs.close(),
      context.mail.close?.(),
      context.db.$disconnect(),
    ]);
    redis.disconnect();
    logger.info('Stopped');
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  if (error instanceof EnvValidationError) {
    console.error(error.message);
    process.exit(78); // EX_CONFIG
  }
  console.error(error);
  process.exit(1);
});
