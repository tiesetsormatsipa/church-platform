import { describe, expect, it } from 'vitest';
import { effectiveSchedules, type ScheduleRow, todayIn } from './schedules.js';

let n = 0;
function row(partial: Partial<ScheduleRow>): ScheduleRow {
  n += 1;
  return {
    id: `id-${n}`,
    kind: 'SERVICE',
    title: null,
    dayOfWeek: 0,
    startTime: '09:00',
    endTime: '12:00',
    recurrenceText: null,
    notes: null,
    effectiveFrom: null,
    effectiveUntil: null,
    replacesRegular: false,
    isActive: true,
    sortOrder: 0,
    ...partial,
  };
}
const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe('effectiveSchedules', () => {
  const sunday = row({ title: 'Sunday service' });
  const study = row({ kind: 'BIBLE_STUDY', dayOfWeek: 3, startTime: '18:30' });
  const tempSunday = row({
    title: 'Sunday (new time)',
    startTime: '09:30',
    effectiveFrom: d('2026-09-01'),
    effectiveUntil: d('2026-10-31'),
    replacesRegular: true,
  });

  it('replaces regular services while a replacing change is in effect', () => {
    const { current, temporary } = effectiveSchedules([sunday, study, tempSunday], '2026-09-24');
    expect(current.map((r) => r.title ?? r.kind)).toEqual(['Sunday (new time)', 'BIBLE_STUDY']);
    expect(temporary).toEqual([tempSunday]);
  });

  it('shows regular services before and after the change, and upcoming changes as notices', () => {
    const before = effectiveSchedules([sunday, tempSunday], '2026-08-15');
    expect(before.current).toEqual([sunday]);
    expect(before.temporary).toEqual([tempSunday]);
    const after = effectiveSchedules([sunday, tempSunday], '2026-11-01');
    expect(after.current).toEqual([sunday]);
    expect(after.temporary).toEqual([]);
  });

  it('adds non-replacing extras alongside regular entries and ignores inactive rows', () => {
    const extra = row({
      title: 'Extra',
      dayOfWeek: 6,
      effectiveFrom: d('2026-09-20'),
      effectiveUntil: d('2026-09-30'),
    });
    const inactive = row({ title: 'Old', isActive: false });
    const { current } = effectiveSchedules([sunday, extra, inactive], '2026-09-24');
    expect(current.map((r) => r.title)).toEqual(['Sunday service', 'Extra']);
  });
});

describe('todayIn', () => {
  it('uses the given time zone', () => {
    // 23:30 UTC on 24 Sep is already 25 Sep in Johannesburg (UTC+2).
    expect(todayIn('Africa/Johannesburg', new Date('2026-09-24T23:30:00Z'))).toBe('2026-09-25');
    expect(todayIn('UTC', new Date('2026-09-24T23:30:00Z'))).toBe('2026-09-24');
  });
});
