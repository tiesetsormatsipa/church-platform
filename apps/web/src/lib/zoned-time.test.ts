import { describe, expect, it } from 'vitest';
import { isoToZonedLocal, zonedLocalToIso } from './zoned-time';

describe('zoned time', () => {
  it('interprets wall-clock time in the given zone, not the browser’s', () => {
    expect(zonedLocalToIso('2026-10-06T12:30', 'Africa/Johannesburg')).toBe('2026-10-06T10:30:00.000Z');
    expect(zonedLocalToIso('2026-10-06T12:30', 'UTC')).toBe('2026-10-06T12:30:00.000Z');
    expect(isoToZonedLocal('2026-10-06T10:30:00.000Z', 'Africa/Johannesburg')).toBe('2026-10-06T12:30');
  });

  it('round-trips across midnight and daylight-saving zones', () => {
    expect(isoToZonedLocal('2026-10-05T23:30:00Z', 'Africa/Johannesburg')).toBe('2026-10-06T01:30');
    const london = zonedLocalToIso('2026-07-01T09:00', 'Europe/London');
    expect(london).toBe('2026-07-01T08:00:00.000Z');
    expect(isoToZonedLocal(london, 'Europe/London')).toBe('2026-07-01T09:00');
    expect(zonedLocalToIso('2026-01-15T09:00', 'Europe/London')).toBe('2026-01-15T09:00:00.000Z');
  });

  it('rejects empty and malformed values', () => {
    expect(zonedLocalToIso('', 'UTC')).toBeNull();
    expect(zonedLocalToIso('06/10/2026 12:30', 'UTC')).toBeNull();
    expect(isoToZonedLocal(null, 'UTC')).toBe('');
    expect(isoToZonedLocal('nonsense', 'UTC')).toBe('');
  });
});
