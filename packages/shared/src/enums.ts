/**
 * Domain enumerations shared by the API, the worker and the web app.
 *
 * These mirror the PostgreSQL enums declared in `packages/database/prisma/schema.prisma`.
 * A test in `@church/database` fails if the two ever drift apart.
 */
import { z } from 'zod';

function enumOf<const T extends readonly [string, ...string[]]>(values: T) {
  return { values, schema: z.enum(values) } as const;
}

export const ContentType = enumOf(['POST', 'ANNOUNCEMENT', 'NEWS', 'EVENT', 'SERMON', 'BAPTISM']);
export type ContentType = (typeof ContentType.values)[number];

export const ContentScope = enumOf(['GLOBAL', 'BRANCH']);
export type ContentScope = (typeof ContentScope.values)[number];

export const ContentStatus = enumOf(['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'ARCHIVED']);
export type ContentStatus = (typeof ContentStatus.values)[number];

export const BodyFormat = enumOf(['MARKDOWN']);
export type BodyFormat = (typeof BodyFormat.values)[number];

export const EventStatus = enumOf(['SCHEDULED', 'POSTPONED', 'CANCELLED']);
export type EventStatus = (typeof EventStatus.values)[number];

export const EventCategory = enumOf([
  'SERVICE',
  'CONFERENCE',
  'BAPTISM',
  'YOUTH',
  'PRAYER',
  'OUTREACH',
  'FELLOWSHIP',
  'OTHER',
]);
export type EventCategory = (typeof EventCategory.values)[number];

export const BranchType = enumOf(['MAIN', 'SUB', 'SATELLITE', 'ONLINE']);
export type BranchType = (typeof BranchType.values)[number];

export const BranchStatus = enumOf(['ACTIVE', 'INACTIVE', 'ARCHIVED']);
export type BranchStatus = (typeof BranchStatus.values)[number];

export const ScheduleKind = enumOf([
  'SERVICE',
  'PRAYER',
  'FASTING',
  'BIBLE_STUDY',
  'YOUTH',
  'OTHER',
]);
export type ScheduleKind = (typeof ScheduleKind.values)[number];

export const UserStatus = enumOf(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']);
export type UserStatus = (typeof UserStatus.values)[number];

export const MembershipStatus = enumOf(['PENDING', 'ACTIVE', 'REJECTED', 'LEFT']);
export type MembershipStatus = (typeof MembershipStatus.values)[number];

export const RoleScope = enumOf(['ORGANIZATION', 'BRANCH']);
export type RoleScope = (typeof RoleScope.values)[number];

export const MediaKind = enumOf(['IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT']);
export type MediaKind = (typeof MediaKind.values)[number];

export const MediaStatus = enumOf([
  'PENDING_UPLOAD',
  'UPLOADED',
  'PROCESSING',
  'READY',
  'FAILED',
  'DELETED',
]);
export type MediaStatus = (typeof MediaStatus.values)[number];

export const MediaVisibility = enumOf(['PUBLIC', 'PRIVATE']);
export type MediaVisibility = (typeof MediaVisibility.values)[number];

export const MediaPurpose = enumOf([
  'COVER',
  'AVATAR',
  'GALLERY',
  'SERMON_AUDIO',
  'SERMON_VIDEO',
  'DOCUMENT',
]);
export type MediaPurpose = (typeof MediaPurpose.values)[number];

export const NotificationCategory = enumOf([
  'ANNOUNCEMENTS',
  'UPDATES',
  'EVENTS',
  'NEWS',
  'SERMONS',
  'BAPTISM',
  'MEMBERSHIP',
  'ACCOUNT',
]);
export type NotificationCategory = (typeof NotificationCategory.values)[number];

export const AuthTokenPurpose = enumOf(['EMAIL_VERIFICATION', 'PASSWORD_RESET']);
export type AuthTokenPurpose = (typeof AuthTokenPurpose.values)[number];

export const AuthProvider = enumOf(['GOOGLE']);
export type AuthProvider = (typeof AuthProvider.values)[number];

/** Which notification category a published content type belongs to. */
export const CONTENT_TYPE_NOTIFICATION_CATEGORY: Record<ContentType, NotificationCategory> = {
  POST: 'UPDATES',
  ANNOUNCEMENT: 'ANNOUNCEMENTS',
  NEWS: 'NEWS',
  EVENT: 'EVENTS',
  SERMON: 'SERMONS',
  BAPTISM: 'BAPTISM',
};

/** Human-readable labels for UI surfaces. */
export const CONTENT_TYPE_LABEL: Record<ContentType, { singular: string; plural: string }> = {
  POST: { singular: 'Update', plural: 'Updates' },
  ANNOUNCEMENT: { singular: 'Announcement', plural: 'Announcements' },
  NEWS: { singular: 'News', plural: 'News' },
  EVENT: { singular: 'Event', plural: 'Events' },
  SERMON: { singular: 'Sermon', plural: 'Sermons' },
  BAPTISM: { singular: 'Baptism', plural: 'Baptisms' },
};

export const EVENT_CATEGORY_LABEL: Record<EventCategory, string> = {
  SERVICE: 'Service',
  CONFERENCE: 'Conference',
  BAPTISM: 'Baptism service',
  YOUTH: 'Youth',
  PRAYER: 'Prayer',
  OUTREACH: 'Outreach',
  FELLOWSHIP: 'Fellowship',
  OTHER: 'Event',
};

export const BRANCH_TYPE_LABEL: Record<BranchType, string> = {
  MAIN: 'Branch',
  SUB: 'Sub-branch',
  SATELLITE: 'Satellite',
  ONLINE: 'Online',
};

export const SCHEDULE_KIND_LABEL: Record<ScheduleKind, string> = {
  SERVICE: 'Service',
  PRAYER: 'Prayer',
  FASTING: 'Fasting',
  BIBLE_STUDY: 'Bible study',
  YOUTH: 'Youth',
  OTHER: 'Other',
};

export const NOTIFICATION_CATEGORY_LABEL: Record<NotificationCategory, string> = {
  ANNOUNCEMENTS: 'Announcements',
  UPDATES: 'Community updates',
  EVENTS: 'Events',
  NEWS: 'News',
  SERMONS: 'Sermons',
  BAPTISM: 'Baptism',
  MEMBERSHIP: 'Membership',
  ACCOUNT: 'Account and security',
};
