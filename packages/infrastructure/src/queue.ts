/**
 * Typed BullMQ producer. Payloads are validated against the contracts in @church/shared
 * before they are enqueued, and again by the worker before they are processed.
 */
import { Queue, type JobsOptions } from 'bullmq';
import { JOBS, QUEUE_NAMES, type JobKey, type JobPayload, type QueueName } from '@church/shared';
import type { Redis } from 'ioredis';

export const QUEUE_PREFIX = 'cp';

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: { age: 24 * 3_600, count: 1_000 },
  removeOnFail: { age: 14 * 24 * 3_600 },
};

export class JobProducer {
  private readonly queues = new Map<QueueName, Queue>();

  constructor(private readonly connection: Redis) {}

  queue(name: QueueName): Queue {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, { connection: this.connection, prefix: QUEUE_PREFIX });
      this.queues.set(name, queue);
    }
    return queue;
  }

  async enqueue<K extends JobKey>(
    key: K,
    payload: JobPayload<K>,
    options: JobsOptions = {},
  ): Promise<string | undefined> {
    const definition = JOBS[key];
    const data = definition.schema.parse(payload);
    const job = await this.queue(definition.queue).add(definition.name, data, {
      ...DEFAULT_JOB_OPTIONS,
      ...options,
    });
    return job.id;
  }

  /** Queue depths for health and admin dashboards. */
  async counts(): Promise<Record<QueueName, Record<string, number>>> {
    const entries = await Promise.all(
      QUEUE_NAMES.map(async (name) => {
        const counts = await this.queue(name).getJobCounts(
          'waiting',
          'active',
          'delayed',
          'failed',
        );
        return [name, counts] as const;
      }),
    );
    return Object.fromEntries(entries) as Record<QueueName, Record<string, number>>;
  }

  async close(): Promise<void> {
    await Promise.all([...this.queues.values()].map((q) => q.close()));
    this.queues.clear();
  }
}
