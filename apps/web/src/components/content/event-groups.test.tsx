import type { ContentSummary } from '@church/shared';
import { describe, expect, it } from 'vitest';
import { groupByMonth } from './event-groups';

function event(id: string, startsAt: string): ContentSummary {
  return {
    id,
    type: 'EVENT',
    slug: id,
    path: `/events/${id}`,
    title: id,
    summary: '',
    scope: 'GLOBAL',
    branch: null,
    publishedAt: '2026-09-01T00:00:00Z',
    isPinned: false,
    isFeatured: false,
    cover: null,
    authorName: null,
    tags: [],
    event: {
      startsAt,
      endsAt: null,
      allDay: false,
      timezone: 'Africa/Johannesburg',
      category: 'SERVICE',
      eventStatus: 'SCHEDULED',
      venueName: null,
    },
    sermon: null,
    song: null,
    collection: 'LOCAL' as const,
    baptism: null,
  };
}

describe('groupByMonth', () => {
  it('groups consecutive events by month in the church time zone', () => {
    const groups = groupByMonth([
      event('a', '2026-09-29T15:00:00Z'),
      // 23:00 UTC on 30 September is already 1 October in Johannesburg.
      event('b', '2026-09-30T23:00:00Z'),
      event('c', '2026-10-06T10:30:00Z'),
      event('d', '2027-08-06T07:00:00Z'),
    ]);
    expect(groups.map((g) => [g.key, g.label, g.items.map((i) => i.id)])).toEqual([
      ['2026-09', 'September 2026', ['a']],
      ['2026-10', 'October 2026', ['b', 'c']],
      ['2027-08', 'August 2027', ['d']],
    ]);
  });
});
