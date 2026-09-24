import type { ContentSummary } from '@church/shared';
import { formatMonth, monthKey } from '@/lib/format';
import { ContentCard } from './content-card';

export interface MonthGroupData {
  key: string;
  label: string;
  items: ContentSummary[];
}

/** Group events by the month they start in, keeping the API order. */
export function groupByMonth(items: ContentSummary[]): MonthGroupData[] {
  const groups: MonthGroupData[] = [];
  for (const item of items) {
    if (!item.event) continue;
    const key = monthKey(item.event.startsAt);
    const last = groups.at(-1);
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, label: formatMonth(item.event.startsAt), items: [item] });
  }
  return groups;
}

export function EventCards({ items }: { items: ContentSummary[] }) {
  return (
    <ul className="flex flex-col gap-4">
      {items.map((item) => (
        <li key={item.id}>
          <ContentCard item={item} headingLevel={3} />
        </li>
      ))}
    </ul>
  );
}

export function MonthGroup({ group }: { group: MonthGroupData }) {
  return (
    <section aria-label={group.label} className="flex flex-col gap-4">
      <h2 className="sticky top-14 z-10 -mx-4 bg-background/95 px-4 py-2 text-lg font-semibold backdrop-blur sm:mx-0 sm:px-0 md:top-16">
        {group.label}
      </h2>
      <EventCards items={group.items} />
    </section>
  );
}
