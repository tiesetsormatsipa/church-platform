import { SCHEDULE_KIND_LABEL, type ScheduleDto } from '@church/shared';
import { cn } from '@church/ui/lib/cn';
import { formatCalendarDate, WEEKDAYS } from '@/lib/format';

function when(s: ScheduleDto): string {
  const day = s.dayOfWeek !== null ? WEEKDAYS[s.dayOfWeek] : s.recurrenceText;
  const time = s.startTime ? (s.endTime ? `${s.startTime}–${s.endTime}` : s.startTime) : null;
  return [day, time].filter(Boolean).join(' · ');
}

/** Weekly schedule; `compact` renders a single line per item for cards. */
export function ServiceTimes({
  schedules,
  compact = false,
  emptyText = 'No times listed yet.',
}: {
  schedules: ScheduleDto[];
  compact?: boolean;
  emptyText?: string;
}) {
  if (schedules.length === 0) return <p className="text-sm text-muted">{emptyText}</p>;
  return (
    <ul className={cn('flex flex-col', compact ? 'gap-0.5 text-sm' : 'divide-y divide-border')}>
      {schedules.map((s) => {
        const temporary = s.effectiveFrom !== null || s.effectiveUntil !== null;
        return (
          <li key={s.id} className={cn(compact ? '' : 'flex flex-col gap-1 py-3 sm:flex-row sm:justify-between')}>
            {compact ? (
              <span>
                <span className="font-medium">{s.title ?? SCHEDULE_KIND_LABEL[s.kind]}</span>
                <span className="text-muted"> · {when(s)}</span>
                {temporary ? <span className="ml-1 text-xs font-medium text-warning">(temporary)</span> : null}
              </span>
            ) : (
              <>
                <div className="flex flex-col">
                  <span className="font-medium">{s.title ?? SCHEDULE_KIND_LABEL[s.kind]}</span>
                  {s.notes ? <span className="text-sm text-muted">{s.notes}</span> : null}
                  {temporary ? (
                    <span className="text-sm font-medium text-warning">
                      Temporary{s.effectiveFrom ? ` from ${formatCalendarDate(s.effectiveFrom)}` : ''}
                      {s.effectiveUntil ? ` until ${formatCalendarDate(s.effectiveUntil)}` : ''}
                    </span>
                  ) : null}
                </div>
                <span className="text-sm text-muted tabular-nums sm:text-right">{when(s)}</span>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
