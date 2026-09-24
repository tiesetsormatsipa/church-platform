/**
 * Queue plumbing: one BullMQ Worker per queue, dispatching by job name.
 *
 * Every payload is validated against its contract in @church/shared before a handler sees
 * it. A payload that cannot be valid (wrong shape, unknown job name) fails permanently
 * instead of retrying five times to no purpose.
 */
import { UnrecoverableError, Worker, type Job } from 'bullmq';
import { QUEUE_PREFIX } from '@church/infrastructure/queue';
import { JOBS, QUEUE_NAMES, type JobKey, type QueueName } from '@church/shared';
import type { Logger } from '@church/infrastructure/logger';
import type { WorkerContext } from './context.js';

/** What a handler receives: the shared context plus this job's identity. */
export interface JobContext extends WorkerContext {
  /** Stable "<queue>:<jobId>" key, used to make side effects idempotent across retries. */
  jobKey: string;
  attempt: number;
}

// The payload type is checked at the registration site (see HANDLERS below), where each
// handler is paired with its own job key; `unknown` here keeps the registry homogeneous.
type Handler = (context: JobContext, payload: never) => Promise<void>;

export type HandlerRegistry = Partial<Record<JobKey, Handler>>;

/** Job name → key, so a BullMQ job can be matched back to its contract. */
const KEY_BY_QUEUE_AND_NAME = new Map<string, JobKey>(
  (Object.keys(JOBS) as JobKey[]).map((key) => [`${JOBS[key].queue}:${JOBS[key].name}`, key]),
);

export function jobKeyFor(queue: QueueName, name: string): JobKey | undefined {
  return KEY_BY_QUEUE_AND_NAME.get(`${queue}:${name}`);
}

export async function runJob(
  context: WorkerContext,
  handlers: HandlerRegistry,
  queue: QueueName,
  job: Job,
): Promise<void> {
  const key = jobKeyFor(queue, job.name);
  if (!key) {
    throw new UnrecoverableError(`Unknown job "${job.name}" on queue "${queue}"`);
  }
  const handler = handlers[key];
  if (!handler) {
    throw new UnrecoverableError(`No handler registered for job "${key}"`);
  }
  const parsed = JOBS[key].schema.safeParse(job.data);
  if (!parsed.success) {
    // Only the field paths: the payload itself may contain an address or a token.
    const issues = parsed.error.issues.map((i) => i.path.join('.') || '(root)').join(', ');
    throw new UnrecoverableError(`Invalid payload for "${key}" (fields: ${issues})`);
  }
  const jobContext: JobContext = {
    ...context,
    jobKey: `${queue}:${job.id ?? job.name}`,
    attempt: job.attemptsMade + 1,
  };
  await handler(jobContext, parsed.data as never);
}

export interface StartWorkersOptions {
  context: WorkerContext;
  handlers: HandlerRegistry;
  concurrency: number;
  logger: Logger;
}

/** Starts a worker for every queue that has at least one registered handler. */
export function startWorkers(options: StartWorkersOptions): Worker[] {
  const { context, handlers, concurrency, logger } = options;
  const active = new Set<QueueName>(
    (Object.keys(handlers) as JobKey[]).map((key) => JOBS[key].queue),
  );
  return QUEUE_NAMES.filter((queue) => active.has(queue)).map((queue) => {
    const worker = new Worker(queue, (job) => runJob(context, handlers, queue, job), {
      connection: context.redis,
      prefix: QUEUE_PREFIX,
      concurrency,
    });
    worker.on('completed', (job) => {
      logger.debug({ queue, job: job.name, id: job.id }, 'Job completed');
    });
    worker.on('failed', (job, error) => {
      const attempts = job?.attemptsMade ?? 0;
      const permanent =
        error instanceof UnrecoverableError || attempts >= (job?.opts.attempts ?? 1);
      logger[permanent ? 'error' : 'warn'](
        { err: error, queue, job: job?.name, id: job?.id, attempts },
        permanent ? 'Job failed permanently' : 'Job failed; will retry',
      );
    });
    worker.on('error', (error) => logger.error({ err: error, queue }, 'Worker error'));
    logger.info({ queue, concurrency }, 'Worker listening');
    return worker;
  });
}
