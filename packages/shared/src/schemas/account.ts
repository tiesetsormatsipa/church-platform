/**
 * The signed-in member's own account: profile, branch membership and notification
 * preferences. Administrators manage other people's accounts through the admin API.
 */
import { z } from 'zod';
import { IsoDateTime, optionalText, Slug, text, Uuid } from '../common.js';
import { MembershipStatus, NotificationCategory } from '../enums.js';
import { BranchRef } from './auth.js';

export const MembershipDto = z
  .object({
    id: Uuid,
    branch: BranchRef,
    status: MembershipStatus.schema,
    isPrimary: z.boolean(),
    message: z.string().nullable(),
    decisionNote: z.string().nullable(),
    requestedAt: IsoDateTime,
    decidedAt: IsoDateTime.nullable(),
  })
  .meta({ id: 'Membership' });
export type MembershipDto = z.infer<typeof MembershipDto>;

export const AccountProfile = z
  .object({
    id: Uuid,
    email: z.string(),
    emailVerified: z.boolean(),
    firstName: z.string(),
    lastName: z.string(),
    displayName: z.string().nullable(),
    phone: z.string().nullable(),
    bio: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    homeBranch: BranchRef.nullable(),
    memberships: z.array(MembershipDto),
    createdAt: IsoDateTime,
  })
  .meta({ id: 'AccountProfile' });
export type AccountProfile = z.infer<typeof AccountProfile>;

/** Partial update: omitted fields are left unchanged; `null` clears optional ones. */
export const UpdateProfileRequest = z
  .object({
    firstName: text(80),
    lastName: text(80),
    displayName: optionalText(120),
    phone: optionalText(40),
    bio: optionalText(1000),
    /** Branch slug the member mostly attends, or null. Informational only (not membership). */
    homeBranch: Slug.nullable(),
  })
  .partial()
  .meta({ id: 'UpdateProfileRequest' });
export type UpdateProfileRequest = z.input<typeof UpdateProfileRequest>;

export const MembershipRequest = z
  .object({
    branch: Slug,
    message: optionalText(1000),
  })
  .meta({ id: 'MembershipRequest' });
export type MembershipRequest = z.input<typeof MembershipRequest>;

export const NotificationPreferenceDto = z.object({
  category: NotificationCategory.schema,
  inApp: z.boolean(),
  email: z.boolean(),
});
export type NotificationPreferenceDto = z.infer<typeof NotificationPreferenceDto>;

export const NotificationPreferences = z
  .object({ items: z.array(NotificationPreferenceDto) })
  .meta({ id: 'NotificationPreferences' });
export type NotificationPreferences = z.infer<typeof NotificationPreferences>;

/** Categories whose e-mails cannot be switched off (security notices). */
export const MANDATORY_EMAIL_CATEGORIES = [
  'ACCOUNT',
] as const satisfies readonly NotificationCategory[];

export const UpdateNotificationPreferences = z
  .object({
    items: z.array(NotificationPreferenceDto).min(1).max(NotificationCategory.values.length),
  })
  .refine((v) => new Set(v.items.map((i) => i.category)).size === v.items.length, {
    error: 'Each category may appear only once',
    path: ['items'],
  })
  .meta({ id: 'UpdateNotificationPreferences' });
export type UpdateNotificationPreferences = z.input<typeof UpdateNotificationPreferences>;
