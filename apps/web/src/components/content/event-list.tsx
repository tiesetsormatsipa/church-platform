import type { ContentSummary } from '@church/shared';
import Link from 'next/link';
import { formatEventTiming } from '@/lib/format';
import { EventStatusBadge, ScopeBadge } from './badges';
import { DateTile } from './date-tile';

/** Compact list of events for sidebars. */
export function EventList({ items }: { items: ContentSummary[] }) {
  return (
    <ul className="flex flex-col divide-y divide-border">
      {items.map((item) =>
        item.event ? (
          <li key={item.id} className="relative flex gap-3 py-3 first:pt-0 last:pb-0">
            <DateTile iso={item.event.startsAt} timeZone={item.event.timezone} cancelled={item.event.eventStatus === 'CANCELLED'} />
            <div className="flex min-w-0 flex-col gap-1">
              <Link href={item.path} className="font-semibold leading-snug after:absolute after:inset-0 hover:underline">
                {item.title}
              </Link>
              <p className="text-sm text-muted">{formatEventTiming(item.event, item.event.timezone)}</p>
              <div className="flex flex-wrap gap-1.5">
                <ScopeBadge scope={item.scope} branch={item.branch} />
                <EventStatusBadge status={item.event.eventStatus} />
              </div>
            </div>
          </li>
        ) : null,
      )}
    </ul>
  );
}
