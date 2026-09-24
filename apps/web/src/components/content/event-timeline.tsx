import type { ContentSummary } from '@church/shared';
import { groupByMonth, MonthGroup } from './event-groups';
import { EventTimelineMore } from './event-timeline-more';

/**
 * Events under month headings. The first page renders on the server (dates are formatted
 * with the server's ICU data, so nothing can mismatch during hydration); later pages load in
 * the browser.
 */
export function EventTimeline({
  initialItems,
  initialCursor,
  query,
}: {
  initialItems: ContentSummary[];
  initialCursor: string | null;
  query: Record<string, string | undefined>;
}) {
  const groups = groupByMonth(initialItems);
  return (
    <div className="flex flex-col gap-10">
      {groups.map((group) => (
        <MonthGroup key={group.key} group={group} />
      ))}
      <EventTimelineMore
        initialCursor={initialCursor}
        query={query}
        lastMonthKey={groups.at(-1)?.key ?? null}
      />
    </div>
  );
}
