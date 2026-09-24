import { describe, expect, it } from 'vitest';
import { dateTile, formatDuration, formatEventTiming, formatRelative, formatTime } from './format';

describe('format', () => {
  it('formats times in the church time zone (UTC+2)', () => {
    expect(formatTime('2026-10-04T07:00:00.000Z')).toBe('09:00');
    expect(dateTile('2026-10-04T07:00:00.000Z')).toEqual({
      day: '4',
      month: 'Oct',
      weekday: 'Sun',
    });
  });

  it('describes single- and multi-day events', () => {
    expect(
      formatEventTiming({
        startsAt: '2026-10-04T07:00:00Z',
        endsAt: '2026-10-04T10:00:00Z',
        allDay: false,
      }),
    ).toMatch(/4 Oct 2026 · 09:00–12:00$/);
    const multi = formatEventTiming({
      startsAt: '2026-08-06T07:00:00Z',
      endsAt: '2026-08-08T16:00:00Z',
      allDay: false,
    });
    expect(multi).toMatch(/6.+8 Aug 2026/);
  });

  it('uses relative time for recent items', () => {
    const now = new Date('2026-09-24T12:00:00Z');
    expect(formatRelative('2026-09-24T11:59:30Z', now)).toBe('just now');
    expect(formatRelative('2026-09-24T09:00:00Z', now)).toBe('3 hours ago');
    expect(formatRelative('2026-09-23T12:00:00Z', now)).toBe('yesterday');
    expect(formatRelative('2026-08-01T12:00:00Z', now)).toBe('1 Aug 2026');
  });

  it('formats durations', () => {
    expect(formatDuration(2460)).toBe('41 min');
    expect(formatDuration(4320)).toBe('1 h 12 min');
    expect(formatDuration(null)).toBeNull();
  });
});
