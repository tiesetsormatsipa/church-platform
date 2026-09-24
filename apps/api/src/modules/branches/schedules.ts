import type { ScheduleDto } from '@church/shared';

export interface ScheduleRow {
  id: string;
  kind: ScheduleDto['kind'];
  title: string | null;
  dayOfWeek: number | null;
  startTime: string | null;
  endTime: string | null;
  recurrenceText: string | null;
  notes: string | null;
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
  replacesRegular: boolean;
  isActive: boolean;
  sortOrder: number;
}

/** Today's date (YYYY-MM-DD) in a time zone. */
export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export function toScheduleDto(row: ScheduleRow): ScheduleDto {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    dayOfWeek: row.dayOfWeek,
    startTime: row.startTime,
    endTime: row.endTime,
    recurrenceText: row.recurrenceText,
    notes: row.notes,
    effectiveFrom: iso(row.effectiveFrom),
    effectiveUntil: iso(row.effectiveUntil),
    replacesRegular: row.replacesRegular,
  };
}

function order(a: ScheduleRow, b: ScheduleRow): number {
  return (
    (a.dayOfWeek ?? 7) - (b.dayOfWeek ?? 7) ||
    (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99') ||
    a.sortOrder - b.sortOrder
  );
}

/**
 * Resolve what is in effect on `today`:
 * - temporary entries (with a date range) apply inside their range;
 * - a temporary entry with `replacesRegular` hides the regular entries of the same kind;
 * - `temporary` lists changes in effect now or starting later, for notices.
 */
export function effectiveSchedules(
  rows: ScheduleRow[],
  today: string,
): { current: ScheduleRow[]; temporary: ScheduleRow[] } {
  const active = rows.filter((r) => r.isActive);
  const isTemporary = (r: ScheduleRow) => r.effectiveFrom !== null || r.effectiveUntil !== null;
  const inEffect = (r: ScheduleRow) =>
    (!r.effectiveFrom || iso(r.effectiveFrom)! <= today) &&
    (!r.effectiveUntil || iso(r.effectiveUntil)! >= today);

  const temporaryNow = active.filter((r) => isTemporary(r) && inEffect(r));
  const replaced = new Set(temporaryNow.filter((r) => r.replacesRegular).map((r) => r.kind));
  const regular = active.filter((r) => !isTemporary(r) && !replaced.has(r.kind));
  const upcomingOrCurrent = active
    .filter((r) => isTemporary(r) && (!r.effectiveUntil || iso(r.effectiveUntil)! >= today))
    .sort((a, b) => (iso(a.effectiveFrom) ?? '').localeCompare(iso(b.effectiveFrom) ?? ''));

  return { current: [...temporaryNow, ...regular].sort(order), temporary: upcomingOrCurrent };
}
