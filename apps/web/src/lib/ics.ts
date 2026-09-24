/**
 * iCalendar (RFC 5545) export for a single event, so visitors can add it to their calendar.
 * Pure function: no I/O, safe to unit test.
 */
export interface IcsEvent {
  id: string;
  title: string;
  description?: string | null;
  url: string;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  timezone: string;
  location?: string | null;
  status: 'SCHEDULED' | 'POSTPONED' | 'CANCELLED';
  updatedAt: string;
}

const STATUS = { SCHEDULED: 'CONFIRMED', POSTPONED: 'TENTATIVE', CANCELLED: 'CANCELLED' } as const;

/** Escape TEXT values (§3.3.11). */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** Fold lines longer than 75 octets (§3.1) without splitting multi-byte characters. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    // Continuation lines start with a space, which counts towards their 75 octets.
    const limit = parts.length === 0 ? 75 : 74;
    if (size + bytes > limit) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

/** 2026-10-06T10:30:00.000Z → 20261006T103000Z */
export function utcStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Calendar date of an instant in a time zone, as YYYYMMDD. */
export function localDate(iso: string, timeZone: string, addDays = 0): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(
    new Date(iso),
  );
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const date = new Date(Date.UTC(get('year'), get('month') - 1, get('day') + addDays));
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

export function buildIcs(event: IcsEvent, options: { host: string; productName: string; now?: Date }): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${escapeText(options.productName)}//Events//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@${options.host}`,
    `DTSTAMP:${utcStamp((options.now ?? new Date()).toISOString())}`,
    `LAST-MODIFIED:${utcStamp(event.updatedAt)}`,
  ];
  if (event.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${localDate(event.startsAt, event.timezone)}`);
    // DTEND is exclusive for all-day events: the day after the last day.
    lines.push(`DTEND;VALUE=DATE:${localDate(event.endsAt ?? event.startsAt, event.timezone, 1)}`);
  } else {
    lines.push(`DTSTART:${utcStamp(event.startsAt)}`);
    if (event.endsAt) lines.push(`DTEND:${utcStamp(event.endsAt)}`);
  }
  lines.push(`SUMMARY:${escapeText(event.title)}`);
  const description = [event.description, event.url].filter(Boolean).join('\n\n');
  if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  lines.push(`URL:${event.url}`, `STATUS:${STATUS[event.status]}`, 'END:VEVENT', 'END:VCALENDAR');
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}
