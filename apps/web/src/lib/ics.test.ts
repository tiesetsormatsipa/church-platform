import { describe, expect, it } from 'vitest';
import { buildIcs, escapeText, foldLine, localDate, utcStamp } from './ics';

const base = {
  id: '0192f0e2-0000-7000-8000-000000000001',
  title: 'Baptism service',
  description: 'Candidates meet at 09:00; bring a towel, a change of clothes.',
  url: 'https://church.example/events/baptism-service',
  startsAt: '2026-10-06T10:30:00.000Z',
  endsAt: '2026-10-06T12:00:00.000Z',
  allDay: false,
  timezone: 'Africa/Johannesburg',
  location: 'Johannesburg branch',
  status: 'SCHEDULED' as const,
  updatedAt: '2026-09-20T08:00:00.000Z',
};
const options = { host: 'church.example', productName: 'Truth of God', now: new Date('2026-09-24T12:00:00Z') };

describe('ics', () => {
  it('escapes text values', () => {
    expect(escapeText('a; b, c\\d\nnext')).toBe('a\\; b\\, c\\\\d\\nnext');
  });

  it('folds long lines at 75 octets without splitting characters', () => {
    const folded = foldLine(`SUMMARY:${'é'.repeat(60)}`);
    const lines = folded.split('\r\n');
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(lines.slice(1).every((l) => l.startsWith(' '))).toBe(true);
    expect(lines.map((l, i) => (i ? l.slice(1) : l)).join('')).toBe(`SUMMARY:${'é'.repeat(60)}`);
  });

  it('formats UTC timestamps and local dates', () => {
    expect(utcStamp('2026-10-06T10:30:00.000Z')).toBe('20261006T103000Z');
    // 23:30 UTC on 5 Oct is already 6 Oct in Johannesburg (UTC+2).
    expect(localDate('2026-10-05T23:30:00Z', 'Africa/Johannesburg')).toBe('20261006');
    expect(localDate('2026-12-31T12:00:00Z', 'Africa/Johannesburg', 1)).toBe('20270101');
  });

  it('builds a timed event with CRLF line endings', () => {
    const ics = buildIcs(base, options);
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics.split('\r\n')).toEqual(
      expect.arrayContaining([
        'BEGIN:VCALENDAR',
        'UID:0192f0e2-0000-7000-8000-000000000001@church.example',
        'DTSTAMP:20260924T120000Z',
        'DTSTART:20261006T103000Z',
        'DTEND:20261006T120000Z',
        'SUMMARY:Baptism service',
        'LOCATION:Johannesburg branch',
        'STATUS:CONFIRMED',
        'END:VCALENDAR',
      ]),
    );
    expect(ics).toContain('DESCRIPTION:Candidates meet at 09:00\\; bring a towel\\, a change of clothes.');
  });

  it('builds all-day events with an exclusive end date and maps status', () => {
    const ics = buildIcs(
      { ...base, allDay: true, startsAt: '2027-08-05T22:00:00Z', endsAt: '2027-08-07T22:00:00Z', status: 'CANCELLED' },
      options,
    );
    expect(ics).toContain('DTSTART;VALUE=DATE:20270806');
    expect(ics).toContain('DTEND;VALUE=DATE:20270809');
    expect(ics).toContain('STATUS:CANCELLED');
  });
});
