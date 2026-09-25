import { describe, expect, it } from 'vitest';
import * as shared from '@church/shared';
import * as db from './generated/prisma/enums.js';

// Guards against drift between PostgreSQL enums (schema.prisma) and @church/shared.
const pairs = [
  ['ContentType', db.ContentType, shared.ContentType.values],
  ['ContentScope', db.ContentScope, shared.ContentScope.values],
  ['ContentStatus', db.ContentStatus, shared.ContentStatus.values],
  ['BodyFormat', db.BodyFormat, shared.BodyFormat.values],
  ['EventStatus', db.EventStatus, shared.EventStatus.values],
  ['EventCategory', db.EventCategory, shared.EventCategory.values],
  ['BranchType', db.BranchType, shared.BranchType.values],
  ['BranchStatus', db.BranchStatus, shared.BranchStatus.values],
  ['ScheduleKind', db.ScheduleKind, shared.ScheduleKind.values],
  ['UserStatus', db.UserStatus, shared.UserStatus.values],
  ['MembershipStatus', db.MembershipStatus, shared.MembershipStatus.values],
  ['RoleScope', db.RoleScope, shared.RoleScope.values],
  ['MediaKind', db.MediaKind, shared.MediaKind.values],
  ['MediaStatus', db.MediaStatus, shared.MediaStatus.values],
  ['MediaVisibility', db.MediaVisibility, shared.MediaVisibility.values],
  ['MediaPurpose', db.MediaPurpose, shared.MediaPurpose.values],
  ['NotificationCategory', db.NotificationCategory, shared.NotificationCategory.values],
  ['AuthTokenPurpose', db.AuthTokenPurpose, shared.AuthTokenPurpose.values],
  ['AuthProvider', db.AuthProvider, shared.AuthProvider.values],
] as const;

describe('enum parity between the database and @church/shared', () => {
  it.each(pairs)('%s matches', (_name, dbEnum, sharedValues) => {
    expect(Object.values(dbEnum).sort()).toEqual([...sharedValues].sort());
  });
});
