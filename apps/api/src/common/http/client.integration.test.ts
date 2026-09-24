import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, TestClient, type TestContext } from '../../test/harness.js';

// Matches INTERNAL_API_TOKEN in vitest.integration.config.ts.
const TOKEN = 'test-internal-api-token-0123456789abcdef';
const SEARCH_LIMIT = 60;

let ctx: TestContext;
let client: TestClient;

beforeAll(async () => {
  ctx = await createTestContext();
  client = new TestClient(ctx.app);
});
afterAll(async () => {
  await ctx?.close();
});

const rand = () => Math.floor(Math.random() * 250) + 1;
const visitor = () => `198.51.${rand()}.${rand()}`;
const search = (headers: Record<string, string>) =>
  client.request('GET', '/api/v1/search?q=convention', { headers });

describe('server-side calls on behalf of visitors', () => {
  it('rate-limits per visitor named by the web server', async () => {
    const first = visitor();
    for (let i = 0; i < SEARCH_LIMIT; i += 1) {
      expect((await search({ 'x-internal-token': TOKEN, 'x-client-ip': first })).status).toBe(200);
    }
    expect((await search({ 'x-internal-token': TOKEN, 'x-client-ip': first })).status).toBe(429);
    // Another visitor behind the same web server is unaffected.
    expect((await search({ 'x-internal-token': TOKEN, 'x-client-ip': visitor() })).status).toBe(
      200,
    );
  });

  it('ignores x-client-ip without the internal token', async () => {
    const spoofed = visitor();
    for (let i = 0; i < SEARCH_LIMIT; i += 1)
      await search({ 'x-internal-token': 'not-the-token', 'x-client-ip': visitor() });
    // All of those counted against the caller's own address, not the spoofed ones.
    expect((await search({ 'x-client-ip': spoofed })).status).toBe(429);
  });
});
