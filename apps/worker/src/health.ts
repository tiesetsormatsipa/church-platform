/**
 * A very small HTTP surface so that orchestrators can tell whether the worker is alive.
 *
 * The worker has no API of its own, which previously left Docker, Playwright and the deploy
 * script with nothing to wait on. `GET /health` answers 200 once the queues are attached and
 * the stores answer, 503 otherwise; anything else is 404.
 */
import { createServer, type Server } from 'node:http';
import type { DatabaseClient } from '@church/database';
import type { Logger } from '@church/infrastructure/logger';
import type { Redis } from '@church/infrastructure/redis';

export interface HealthServerOptions {
  port: number;
  host?: string;
  db: DatabaseClient;
  redis: Redis;
  logger: Logger;
  queues: readonly string[];
}

export function startHealthServer(options: HealthServerOptions): Server {
  const { port, host = '0.0.0.0', db, redis, logger, queues } = options;

  const server = createServer((request, response) => {
    if (request.method !== 'GET' || !request.url?.startsWith('/health')) {
      response.writeHead(404).end();
      return;
    }
    void (async () => {
      const [database, cache] = await Promise.all([
        db.$queryRaw`SELECT 1`.then(
          () => 'up' as const,
          () => 'down' as const,
        ),
        redis.ping().then(
          () => 'up' as const,
          () => 'down' as const,
        ),
      ]);
      const ok = database === 'up' && cache === 'up';
      const body = JSON.stringify({
        status: ok ? 'ok' : 'degraded',
        queues,
        checks: { database, redis: cache },
      });
      response.writeHead(ok ? 200 : 503, { 'content-type': 'application/json' }).end(body);
    })();
  });

  server.listen(port, host, () => logger.info({ port }, 'Health endpoint listening'));
  server.on('error', (error) => logger.error({ err: error }, 'Health server error'));
  return server;
}
