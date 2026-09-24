/**
 * Date and time formatting in the church's time zone, using Intl only.
 * All functions are pure so they work in Server and Client Components alike.
 */
export const DEFAULT_TIME_ZONE = 'Africa/Johannesburg';
// en-GB matches South African day-month-year order and 24-hour time, without the zero-padded
// days that ICU's en-ZA data produces ("01 Aug").
export const LOCALE = 'en-GB';

const cache = new Map<string, Intl.DateTimeFormat>();
function formatter(options: Intl.DateTimeFormatOptions, timeZone: string): Intl.DateTimeFormat {
  const key = JSON.stringify([options, timeZone]);
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(LOCALE, { ...options, timeZone });
    cache.set(key, f);
  }
  return f;
}

/** "Sunday, 6 August 2026" */
export function formatLongDate(iso: string, timeZone = DEFAULT_TIME_ZONE): string {
  return formatter({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, timeZone).format(new Date(iso));
}

/** "6 Aug 2026" */
export function formatDate(iso: string, timeZone = DEFAULT_TIME_ZONE): string {
  return formatter({ day: 'numeric', month: 'short', year: 'numeric' }, timeZone).format(new Date(iso));
}

/** Calendar date without time zone shifting ("2026-09-17" → "17 Sep 2026"). */
export function formatCalendarDate(date: string): string {
  return formatter({ day: 'numeric', month: 'short', year: 'numeric' }, 'UTC').format(new Date(`${date}T00:00:00Z`));
}

/** "09:30" (24-hour, as used in South Africa) */
export function formatTime(iso: string, timeZone = DEFAULT_TIME_ZONE): string {
  return formatter({ hour: '2-digit', minute: '2-digit', hour12: false }, timeZone).format(new Date(iso));
}

/** Parts for a calendar tile: { day: "6", month: "Aug", weekday: "Sun" } */
export function dateTile(iso: string, timeZone = DEFAULT_TIME_ZONE) {
  const parts = formatter({ day: 'numeric', month: 'short', weekday: 'short' }, timeZone).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return { day: get('day'), month: get('month').replace('.', ''), weekday: get('weekday').replace('.', '') };
}

function sameDay(a: string, b: string, timeZone: string): boolean {
  const f = formatter({ year: 'numeric', month: '2-digit', day: '2-digit' }, timeZone);
  return f.format(new Date(a)) === f.format(new Date(b));
}

/**
 * Human event timing:
 *  - "Sun 6 Aug 2026 · 09:00–12:00"
 *  - "6–8 Aug 2026" (multi-day), "All day" events without times
 */
export function formatEventTiming(
  event: { startsAt: string; endsAt: string | null; allDay: boolean },
  timeZone = DEFAULT_TIME_ZONE,
): string {
  const start = new Date(event.startsAt);
  const dateLabel = formatter({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }, timeZone).format(start);
  if (event.endsAt && !sameDay(event.startsAt, event.endsAt, timeZone)) {
    return formatter({ day: 'numeric', month: 'short', year: 'numeric' }, timeZone).formatRange(start, new Date(event.endsAt));
  }
  if (event.allDay) return `${dateLabel} · All day`;
  const time = event.endsAt
    ? `${formatTime(event.startsAt, timeZone)}–${formatTime(event.endsAt, timeZone)}`
    : formatTime(event.startsAt, timeZone);
  return `${dateLabel} · ${time}`;
}

const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });

/** "3 hours ago", "yesterday"; falls back to a date after a week. */
export function formatRelative(iso: string, now = new Date(), timeZone = DEFAULT_TIME_ZONE): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return 'just now';
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute');
  if (abs < 86_400) return relative.format(Math.round(seconds / 3600), 'hour');
  if (abs < 7 * 86_400) return relative.format(Math.round(seconds / 86_400), 'day');
  return formatDate(iso, timeZone);
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/** "41 min", "1 h 12 min" */
export function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}
