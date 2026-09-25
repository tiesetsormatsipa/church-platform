/**
 * Administration contracts other than content: dashboard, memberships,
 * people and roles, branches (details, schedules, leaders), audit log and settings.
 */
import { z } from 'zod';
import {
  HttpUrl,
  IsoDate,
  IsoDateTime,
  OffsetPageQuery,
  offsetPage,
  optionalText,
  Slug,
  text,
  TimeOfDay,
  Uuid,
} from '../common.js';
import {
  BranchStatus,
  BranchType,
  ContentType,
  MembershipStatus,
  NotificationCategory,
  RoleScope,
  ScheduleKind,
  UserStatus,
} from '../enums.js';
import { BranchRef, EmailAddress } from './auth.js';

export const PersonRef = z.object({ id: Uuid, name: z.string(), email: z.string() });
export type PersonRef = z.infer<typeof PersonRef>;

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export const AdminSummary = z
  .object({
    /** Which admin areas the user may open. */
    areas: z.object({
      content: z.boolean(),
      memberships: z.boolean(),
      people: z.boolean(),
      branches: z.boolean(),
      records: z.boolean(),
      audit: z.boolean(),
      settings: z.boolean(),
    }),
    counts: z.object({
      contentAwaitingReview: z.number().int(),
      myDrafts: z.number().int(),
      pendingMemberships: z.number().int(),
      upcomingEvents: z.number().int(),
    }),
  })
  .meta({ id: 'AdminSummary' });
export type AdminSummary = z.infer<typeof AdminSummary>;

// ---------------------------------------------------------------------------
// Memberships
// ---------------------------------------------------------------------------

export const AdminMembershipQuery = OffsetPageQuery.extend({
  status: MembershipStatus.schema.optional(),
  branch: Slug.optional(),
});

export const AdminMembershipRow = z
  .object({
    id: Uuid,
    person: PersonRef,
    branch: BranchRef,
    status: MembershipStatus.schema,
    message: z.string().nullable(),
    decisionNote: z.string().nullable(),
    requestedAt: IsoDateTime,
    decidedAt: IsoDateTime.nullable(),
    decidedBy: z.string().nullable(),
  })
  .meta({ id: 'AdminMembershipRow' });
export type AdminMembershipRow = z.infer<typeof AdminMembershipRow>;

export const AdminMembershipList = offsetPage(AdminMembershipRow).meta({
  id: 'AdminMembershipList',
});
export type AdminMembershipList = z.infer<typeof AdminMembershipList>;

export const MembershipDecision = z
  .object({
    decision: z.enum(['APPROVE', 'REJECT', 'REMOVE']),
    /** Shown to the member when a request is declined. */
    note: optionalText(1000),
  })
  .meta({ id: 'MembershipDecision' });
export type MembershipDecision = z.input<typeof MembershipDecision>;

// ---------------------------------------------------------------------------
// People and roles
// ---------------------------------------------------------------------------

export const AdminUserQuery = OffsetPageQuery.extend({
  q: z.string().trim().max(100).optional(),
  status: UserStatus.schema.optional(),
  branch: Slug.optional(),
});

export const AdminUserRow = z
  .object({
    id: Uuid,
    name: z.string(),
    email: z.string(),
    emailVerified: z.boolean(),
    status: UserStatus.schema,
    homeBranch: BranchRef.nullable(),
    roles: z.array(z.string()),
    lastLoginAt: IsoDateTime.nullable(),
    createdAt: IsoDateTime,
  })
  .meta({ id: 'AdminUserRow' });
export type AdminUserRow = z.infer<typeof AdminUserRow>;

export const AdminUserList = offsetPage(AdminUserRow).meta({ id: 'AdminUserList' });
export type AdminUserList = z.infer<typeof AdminUserList>;

export const RoleAssignmentDto = z.object({
  id: Uuid,
  role: z.object({ key: z.string(), name: z.string(), scope: RoleScope.schema }),
  branch: BranchRef.nullable(),
  grantedBy: z.string().nullable(),
  grantedAt: IsoDateTime,
  /** Whether the current user may revoke it. */
  revocable: z.boolean(),
});
export type RoleAssignmentDto = z.infer<typeof RoleAssignmentDto>;

export const AdminUserDetail = AdminUserRow.extend({
  phone: z.string().nullable(),
  statusReason: z.string().nullable(),
  memberships: z.array(
    z.object({
      id: Uuid,
      branch: BranchRef,
      status: MembershipStatus.schema,
      requestedAt: IsoDateTime,
    }),
  ),
  assignments: z.array(RoleAssignmentDto),
  /** Whether the current user may suspend or reactivate the account. */
  canManageStatus: z.boolean(),
}).meta({ id: 'AdminUserDetail' });
export type AdminUserDetail = z.infer<typeof AdminUserDetail>;

export const RoleDto = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  scope: RoleScope.schema,
  /** Seniority; lower is more senior. */
  rank: z.number().int(),
  /** Content types the role covers. Empty means every type. */
  contentTypes: z.array(ContentType.schema),
  permissions: z.array(z.string()),
});
export type RoleDto = z.infer<typeof RoleDto>;
export const RoleList = z.object({ items: z.array(RoleDto) }).meta({ id: 'RoleList' });

export const AssignRoleRequest = z
  .object({
    role: z.string().min(1).max(64),
    /** Branch slug for branch roles; null for church-wide roles. */
    branch: Slug.nullable(),
  })
  .meta({ id: 'AssignRoleRequest' });
export type AssignRoleRequest = z.input<typeof AssignRoleRequest>;

export const UpdateUserStatusRequest = z
  .object({
    status: z.enum(['ACTIVE', 'SUSPENDED']),
    reason: optionalText(500),
  })
  .meta({ id: 'UpdateUserStatusRequest' });
export type UpdateUserStatusRequest = z.input<typeof UpdateUserStatusRequest>;

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------

export const AdminBranchRow = z
  .object({
    id: Uuid,
    slug: z.string(),
    name: z.string(),
    type: BranchType.schema,
    status: BranchStatus.schema,
    city: z.string().nullable(),
    province: z.string().nullable(),
    memberCount: z.number().int(),
    canEdit: z.boolean(),
  })
  .meta({ id: 'AdminBranchRow' });
export type AdminBranchRow = z.infer<typeof AdminBranchRow>;
export const AdminBranchList = z
  .object({ items: z.array(AdminBranchRow) })
  .meta({ id: 'AdminBranchList' });

export const BranchInput = z
  .object({
    name: text(120),
    /** Generated from the name for new branches; changing it later breaks links. */
    slug: Slug.optional(),
    type: BranchType.schema.default('MAIN'),
    parentBranch: Slug.nullable().optional(),
    description: optionalText(5000),
    addressLine1: optionalText(200),
    addressLine2: optionalText(200),
    city: optionalText(120),
    province: optionalText(120),
    postalCode: optionalText(20),
    countryCode: z
      .string()
      .regex(/^[A-Z]{2}$/, 'Use a two-letter country code')
      .default('ZA'),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    mapsUrl: HttpUrl.nullable().optional(),
    phone: optionalText(40),
    email: EmailAddress.nullable().optional(),
    sortOrder: z.number().int().min(0).max(10_000).default(0),
  })
  .meta({ id: 'BranchInput' });
export type BranchInput = z.input<typeof BranchInput>;

export const ScheduleInput = z
  .object({
    kind: ScheduleKind.schema,
    title: optionalText(120),
    dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
    startTime: TimeOfDay.nullable().optional(),
    endTime: TimeOfDay.nullable().optional(),
    recurrenceText: optionalText(200),
    notes: optionalText(500),
    effectiveFrom: IsoDate.nullable().optional(),
    effectiveUntil: IsoDate.nullable().optional(),
    replacesRegular: z.boolean().default(false),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().min(0).max(10_000).default(0),
  })
  .refine((s) => s.dayOfWeek != null || Boolean(s.recurrenceText), {
    path: ['dayOfWeek'],
    error: 'Choose a day, or describe when it happens',
  })
  .refine((s) => !s.effectiveFrom || !s.effectiveUntil || s.effectiveUntil >= s.effectiveFrom, {
    path: ['effectiveUntil'],
    error: 'The end date must be after the start date',
  })
  .meta({ id: 'ScheduleInput' });
export type ScheduleInput = z.input<typeof ScheduleInput>;

export const AdminScheduleDto = z.object({
  id: Uuid,
  kind: ScheduleKind.schema,
  title: z.string().nullable(),
  dayOfWeek: z.number().int().nullable(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  recurrenceText: z.string().nullable(),
  notes: z.string().nullable(),
  effectiveFrom: IsoDate.nullable(),
  effectiveUntil: IsoDate.nullable(),
  replacesRegular: z.boolean(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
});
export type AdminScheduleDto = z.infer<typeof AdminScheduleDto>;

export const LeaderInput = z
  .object({
    name: text(120),
    title: text(120),
    bio: optionalText(1000),
    sortOrder: z.number().int().min(0).max(10_000).default(0),
    isActive: z.boolean().default(true),
  })
  .meta({ id: 'LeaderInput' });
export type LeaderInput = z.input<typeof LeaderInput>;

export const AdminLeaderDto = z.object({
  id: Uuid,
  name: z.string(),
  title: z.string(),
  bio: z.string().nullable(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
});
export type AdminLeaderDto = z.infer<typeof AdminLeaderDto>;

export const AdminBranchDetail = z
  .object({
    id: Uuid,
    slug: z.string(),
    name: z.string(),
    type: BranchType.schema,
    status: BranchStatus.schema,
    legacyLabel: z.string().nullable(),
    parentBranch: BranchRef.nullable(),
    description: z.string().nullable(),
    addressLine1: z.string().nullable(),
    addressLine2: z.string().nullable(),
    city: z.string().nullable(),
    province: z.string().nullable(),
    postalCode: z.string().nullable(),
    countryCode: z.string(),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
    mapsUrl: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    sortOrder: z.number().int(),
    schedules: z.array(AdminScheduleDto),
    leaders: z.array(AdminLeaderDto),
    canArchive: z.boolean(),
  })
  .meta({ id: 'AdminBranchDetail' });
export type AdminBranchDetail = z.infer<typeof AdminBranchDetail>;

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export const AuditQuery = OffsetPageQuery.extend({
  action: z.string().max(64).optional(),
  entityType: z.string().max(64).optional(),
  entityId: z.string().max(64).optional(),
  actor: Uuid.optional(),
  from: IsoDate.optional(),
  to: IsoDate.optional(),
});

export const AuditEntryDto = z
  .object({
    id: Uuid,
    action: z.string(),
    entityType: z.string(),
    entityId: z.string().nullable(),
    summary: z.string().nullable(),
    actor: PersonRef.nullable(),
    branch: BranchRef.nullable(),
    changes: z.record(z.string(), z.object({ from: z.unknown(), to: z.unknown() })).nullable(),
    ipAddress: z.string().nullable(),
    requestId: z.string().nullable(),
    createdAt: IsoDateTime,
  })
  .meta({ id: 'AuditEntry' });
export type AuditEntryDto = z.infer<typeof AuditEntryDto>;

export const AuditList = offsetPage(AuditEntryDto).meta({ id: 'AuditList' });
export type AuditList = z.infer<typeof AuditList>;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const OrganizationSettingsInput = z
  .object({
    name: text(160),
    shortName: optionalText(60),
    tagline: optionalText(200),
    description: optionalText(5000),
    email: EmailAddress.nullable().optional(),
    phone: optionalText(40),
    websiteUrl: HttpUrl.nullable().optional(),
    timezone: z.string().min(1).max(64),
    registrationOpen: z.boolean(),
    defaultInAppCategories: z.array(NotificationCategory.schema),
    defaultEmailCategories: z.array(NotificationCategory.schema),
    socialLinks: z.object({
      facebook: HttpUrl.nullable().optional(),
      youtube: HttpUrl.nullable().optional(),
      instagram: HttpUrl.nullable().optional(),
      x: HttpUrl.nullable().optional(),
    }),
  })
  .meta({ id: 'OrganizationSettingsInput' });
export type OrganizationSettingsInput = z.input<typeof OrganizationSettingsInput>;

export const AdminOrganization = z
  .object({
    name: z.string(),
    shortName: z.string().nullable(),
    tagline: z.string().nullable(),
    description: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    websiteUrl: z.string().nullable(),
    timezone: z.string(),
    registrationOpen: z.boolean(),
    defaultInAppCategories: z.array(NotificationCategory.schema),
    defaultEmailCategories: z.array(NotificationCategory.schema),
    socialLinks: z.object({
      facebook: z.string().nullable(),
      youtube: z.string().nullable(),
      instagram: z.string().nullable(),
      x: z.string().nullable(),
    }),
  })
  .meta({ id: 'AdminOrganization' });
export type AdminOrganization = z.infer<typeof AdminOrganization>;
