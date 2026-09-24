import { describe, expect, it } from 'vitest';
import { visitorIp } from './visitor-ip';

const h = (values: Record<string, string>) => new Headers(values);

describe('visitorIp', () => {
  it('prefers X-Real-IP set by the proxy', () => {
    expect(
      visitorIp(h({ 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '1.1.1.1, 203.0.113.8' })),
    ).toBe('203.0.113.7');
  });
  it('uses the last X-Forwarded-For hop, never the client-supplied first one', () => {
    expect(visitorIp(h({ 'x-forwarded-for': '6.6.6.6, 203.0.113.8' }))).toBe('203.0.113.8');
    expect(visitorIp(h({ 'x-forwarded-for': '2001:db8::1' }))).toBe('2001:db8::1');
  });
  it('returns null for missing or malformed values', () => {
    expect(visitorIp(h({}))).toBeNull();
    expect(visitorIp(h({ 'x-real-ip': 'evil', 'x-forwarded-for': 'also-evil' }))).toBeNull();
  });
});
