import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { createWorkerTestContext, type WorkerTestContext } from './test/harness.js';
import { startHealthServer } from './health.js';

let ctx: WorkerTestContext;
let server: Server;
let base: string;

beforeAll(async () => {
  ctx = await createWorkerTestContext();
  server = startHealthServer({
    // Port 0 asks the OS for a free one, so the test never clashes with a running worker.
    port: 0,
    host: '127.0.0.1',
    db: ctx.db,
    redis: ctx.redis,
    logger: ctx.context.logger,
    queues: ['email', 'web'],
  });
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (typeof address === 'string' || !address) throw new Error('No address');
  base = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  server?.close();
  await ctx?.close();
});

describe('worker health endpoint', () => {
  it('reports the queues and the stores it depends on', async () => {
    const response = await fetch(`${base}/health`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      queues: ['email', 'web'],
      checks: { database: 'up', redis: 'up' },
    });
  });

  it('answers 404 for anything else, so it is not mistaken for an API', async () => {
    const response = await fetch(`${base}/`);
    expect(response.status).toBe(404);
  });

  it('refuses methods other than GET', async () => {
    const response = await fetch(`${base}/health`, { method: 'POST' });
    expect(response.status).toBe(404);
  });
});
