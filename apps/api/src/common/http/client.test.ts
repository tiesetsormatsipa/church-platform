import type { FastifyRequest } from 'fastify';
import { describe, expect, it } from 'vitest';
import { resolveClient } from './client.js';

const TOKEN = 'internal-token-for-tests-0123456789abcdef';

function request(headers: Record<string, string>, ip = '10.0.0.5'): FastifyRequest {
  return { headers, ip } as unknown as FastifyRequest;
}

describe('resolveClient', () => {
  it('uses the socket address for ordinary requests and ignores x-client-ip', () => {
    expect(resolveClient(request({ 'x-client-ip': '203.0.113.9' }), TOKEN)).toEqual({ ip: '10.0.0.5', internal: false });
  });

  it('trusts x-client-ip only with the internal token', () => {
    expect(resolveClient(request({ 'x-internal-token': TOKEN, 'x-client-ip': '203.0.113.9' }), TOKEN)).toEqual({
      ip: '203.0.113.9',
      internal: true,
    });
    expect(resolveClient(request({ 'x-internal-token': 'wrong', 'x-client-ip': '203.0.113.9' }), TOKEN).internal).toBe(false);
  });

  it('rejects malformed client IPs and never trusts callers when no token is configured', () => {
    expect(resolveClient(request({ 'x-internal-token': TOKEN, 'x-client-ip': 'not-an-ip' }), TOKEN)).toEqual({ ip: null, internal: true });
    expect(resolveClient(request({ 'x-internal-token': '', 'x-client-ip': '203.0.113.9' }), undefined).internal).toBe(false);
    expect(resolveClient(request({ 'x-internal-token': TOKEN }), undefined).internal).toBe(false);
  });
});
