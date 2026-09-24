import { describe, expect, it } from 'vitest';
import {
  BRANCH_TYPE_LABEL,
  BranchType,
  CONTENT_TYPE_LABEL,
  ContentType,
  EVENT_CATEGORY_LABEL,
  EventCategory,
  NOTIFICATION_CATEGORY_LABEL,
  NotificationCategory,
  SCHEDULE_KIND_LABEL,
  ScheduleKind,
} from './enums.js';

describe('enum labels', () => {
  it.each([
    ['content types', ContentType.values, CONTENT_TYPE_LABEL],
    ['event categories', EventCategory.values, EVENT_CATEGORY_LABEL],
    ['branch types', BranchType.values, BRANCH_TYPE_LABEL],
    ['schedule kinds', ScheduleKind.values, SCHEDULE_KIND_LABEL],
    ['notification categories', NotificationCategory.values, NOTIFICATION_CATEGORY_LABEL],
  ] as const)('label every value of %s and nothing else', (_name, values, labels) => {
    expect(Object.keys(labels).sort()).toEqual([...values].sort());
  });

  it('parses values case-sensitively', () => {
    expect(EventCategory.schema.safeParse('BAPTISM').success).toBe(true);
    expect(EventCategory.schema.safeParse('baptism').success).toBe(false);
  });
});
