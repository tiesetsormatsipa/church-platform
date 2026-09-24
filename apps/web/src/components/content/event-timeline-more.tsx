'use client';

import { EventCards, groupByMonth, MonthGroup } from './event-groups';
import { LoadMoreButton } from './load-more-button';
import { usePagedItems } from './use-paged-items';

/** Later pages of the event timeline; continues the last server-rendered month without repeating its heading. */
export function EventTimelineMore({
  initialCursor,
  query,
  lastMonthKey,
}: {
  initialCursor: string | null;
  query: Record<string, string | undefined>;
  lastMonthKey: string | null;
}) {
  const { items, hasMore, status, loadMore } = usePagedItems('/api/v1/events', query, initialCursor);
  const groups = groupByMonth(items);
  return (
    <>
      {groups.map((group, index) =>
        index === 0 && group.key === lastMonthKey ? (
          <div key={group.key} className="-mt-6">
            <EventCards items={group.items} />
          </div>
        ) : (
          <MonthGroup key={group.key} group={group} />
        ),
      )}
      <LoadMoreButton hasMore={hasMore} status={status} onLoad={loadMore} loadedAny={items.length > 0} />
    </>
  );
}
