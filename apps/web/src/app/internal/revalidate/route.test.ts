import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const revalidateTag = vi.hoisted(() => vi.fn());
vi.mock('next/cache', () => ({ revalidateTag }));

const secret = vi.hoisted(() => ({ value: 'test-revalidate-secret-at-least-32-chars' }));
vi.mock('@/lib/env', () => ({
  serverEnv: {
    get revalidateSecret() {
      return secret.value;
    },
  },
}));

const { POST } = await import('./route');

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost:3000/internal/revalidate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const authorised = { authorization: `Bearer ${secret.value}` };

describe('POST /internal/revalidate', () => {
  beforeEach(() => {
    secret.value = 'test-revalidate-secret-at-least-32-chars';
  });
  afterEach(() => {
    revalidateTag.mockClear();
  });

  it('revalidates each tag so the next request is not served stale content', async () => {
    const response = await POST(post({ tags: ['content', 'content:advent-service'] }, authorised));
    expect(response.status).toBe(204);
    expect(revalidateTag.mock.calls).toEqual([
      ['content', { expire: 0 }],
      ['content:advent-service', { expire: 0 }],
    ]);
  });

  it('refuses a request without a bearer token', async () => {
    const response = await POST(post({ tags: ['content'] }));
    expect(response.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('refuses a wrong secret', async () => {
    const response = await POST(
      post({ tags: ['content'] }, { authorization: 'Bearer not-the-secret-but-same-ish-length' }),
    );
    expect(response.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('refuses a secret of a different length without throwing', async () => {
    const response = await POST(post({ tags: ['content'] }, { authorization: 'Bearer short' }));
    expect(response.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('ignores a non-bearer authorization scheme', async () => {
    const response = await POST(
      post({ tags: ['content'] }, { authorization: `Basic ${secret.value}` }),
    );
    expect(response.status).toBe(401);
  });

  it('rejects a payload that is not a tag list', async () => {
    for (const body of [{}, { tags: [] }, { tags: [''] }, { tags: 'content' }, null]) {
      const response = await POST(post(body, authorised));
      expect(response.status, JSON.stringify(body)).toBe(400);
    }
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('rejects more tags than the contract allows', async () => {
    const tags = Array.from({ length: 51 }, (_, i) => `content:${i}`);
    const response = await POST(post({ tags }, authorised));
    expect(response.status).toBe(400);
  });

  it('refuses every request when no secret is configured', async () => {
    secret.value = '';
    const response = await POST(post({ tags: ['content'] }, authorised));
    expect(response.status).toBe(503);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
