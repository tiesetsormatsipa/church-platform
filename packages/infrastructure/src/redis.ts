import { Redis, type RedisOptions } from 'ioredis';

export type { Redis };

export interface CreateRedisOptions {
  url: string;
  /** Connection name shown by `CLIENT LIST`. */
  name: string;
  /** BullMQ workers require `null` (blocking commands must not be retried by ioredis). */
  maxRetriesPerRequest?: number | null;
  lazyConnect?: boolean;
}

export function createRedis(options: CreateRedisOptions): Redis {
  const redisOptions: RedisOptions = {
    connectionName: options.name,
    maxRetriesPerRequest: options.maxRetriesPerRequest === undefined ? 3 : options.maxRetriesPerRequest,
    enableReadyCheck: true,
    lazyConnect: options.lazyConnect ?? false,
    retryStrategy: (times) => Math.min(times * 200, 5_000),
  };
  return new Redis(options.url, redisOptions);
}
