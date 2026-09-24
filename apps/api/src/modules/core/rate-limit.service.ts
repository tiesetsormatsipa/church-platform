import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from '@church/infrastructure/redis';
import { REDIS } from '../../infrastructure/tokens.js';

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  remaining: number;
  retryAfterMs: number;
}

// Fixed-window counter: increment, set the window on first hit, report count and TTL.
const HIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
return { count, ttl }
`;

/**
 * Redis-backed rate limiting shared by every API replica (ADR-017).
 * Fails open when Redis is unavailable (logged), so an outage does not lock everyone out;
 * account lockout is additionally persisted in PostgreSQL.
 */
@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    try {
      const [count, ttl] = (await this.redis.eval(
        HIT_SCRIPT,
        1,
        `rl:${key}`,
        String(windowMs),
      )) as [number, number];
      return {
        allowed: count <= limit,
        count,
        remaining: Math.max(0, limit - count),
        retryAfterMs: count > limit ? Math.max(ttl, 0) : 0,
      };
    } catch (error) {
      this.logger.error({ err: error, key }, 'Rate limiter unavailable; allowing request');
      return { allowed: true, count: 0, remaining: limit, retryAfterMs: 0 };
    }
  }

  /** Current count without incrementing. */
  async count(key: string): Promise<{ count: number; ttlMs: number }> {
    try {
      const [value, ttl] = await Promise.all([
        this.redis.get(`rl:${key}`),
        this.redis.pttl(`rl:${key}`),
      ]);
      return { count: Number(value ?? 0), ttlMs: Math.max(ttl, 0) };
    } catch {
      return { count: 0, ttlMs: 0 };
    }
  }

  async reset(key: string): Promise<void> {
    try {
      await this.redis.del(`rl:${key}`);
    } catch (error) {
      this.logger.warn({ err: error, key }, 'Could not reset rate limit');
    }
  }
}
