import { cn } from '@church/ui/lib/cn';
import { dateTile } from '@/lib/format';

/** Calendar-style date block for events. */
export function DateTile({
  iso,
  timeZone,
  className,
  cancelled,
}: {
  iso: string;
  timeZone?: string;
  className?: string;
  cancelled?: boolean;
}) {
  const { day, month, weekday } = dateTile(iso, timeZone);
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex w-14 shrink-0 flex-col items-center self-start overflow-hidden rounded-lg border border-border bg-surface text-center shadow-card',
        cancelled && 'opacity-60',
        className,
      )}
    >
      <span className="w-full bg-primary py-0.5 text-[0.6875rem] font-semibold tracking-wide text-primary-foreground uppercase">
        {month}
      </span>
      <span className="pt-1 font-serif text-2xl leading-none font-semibold">{day}</span>
      <span className="pb-1 text-[0.6875rem] text-muted">{weekday}</span>
    </div>
  );
}
