import { Controller, Get, Inject, Res, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { DatabaseClient } from '@church/database';
import type { Redis } from '@church/infrastructure/redis';
import type { ObjectStorage } from '@church/infrastructure/storage';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import { ApiResult, Public } from '../../common/decorators/index.js';
import { DATABASE, REDIS, STORAGE } from '../../infrastructure/tokens.js';

const Check = z.object({ status: z.enum(['up', 'down']), latencyMs: z.number() });
const LiveResponse = z.object({ status: z.literal('ok') });
const ReadyResponse = z.object({
  status: z.enum(['ok', 'degraded', 'down']),
  checks: z.object({ database: Check, redis: Check, storage: Check }),
});

async function timed(check: () => Promise<unknown>, timeoutMs = 2_000): Promise<z.infer<typeof Check>> {
  const started = performance.now();
  try {
    await Promise.race([
      check(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ]);
    return { status: 'up', latencyMs: Math.round(performance.now() - started) };
  } catch {
    return { status: 'down', latencyMs: Math.round(performance.now() - started) };
  }
}

@ApiTags('health')
@Public()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(STORAGE) private readonly storage: ObjectStorage,
  ) {}

  /** The process is running (used by Docker to restart hung containers). */
  @Get('live')
  @ApiResult(LiveResponse)
  live() {
    return { status: 'ok' as const };
  }

  /** Dependencies are reachable. Database and Redis are required; storage degrades. */
  @Get('ready')
  @ApiResult(ReadyResponse)
  async ready(@Res({ passthrough: true }) reply: FastifyReply) {
    const [database, redis, storage] = await Promise.all([
      timed(() => this.db.$queryRaw`SELECT 1`),
      timed(() => this.redis.ping()),
      timed(() => this.storage.ping()),
    ]);
    const critical = database.status === 'up' && redis.status === 'up';
    const status = !critical ? 'down' : storage.status === 'up' ? 'ok' : 'degraded';
    void reply.status(critical ? 200 : 503).header('cache-control', 'no-store');
    return { status, checks: { database, redis, storage } } as const;
  }
}
