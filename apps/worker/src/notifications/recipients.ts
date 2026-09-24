/**
 * Who should hear about something.
 *
 * Only active, undeleted accounts are ever returned. Permission-based audiences are
 * resolved from role assignments exactly the way the API's guards do: a church-wide grant
 * (`branchId = null`) covers every branch, a branch grant covers only its own.
 */
import type { DatabaseClient } from '@church/database';
import type { Permission } from '@church/shared';
import type { Recipient } from './deliver.js';

const RECIPIENT_SELECT = {
  id: true,
  email: true,
  emailVerifiedAt: true,
  profile: { select: { firstName: true } },
  notificationPreferences: { select: { category: true, inApp: true, email: true } },
} as const;

type Row = {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  profile: { firstName: string } | null;
  notificationPreferences: {
    category: Recipient['preferences'][number]['category'];
    inApp: boolean;
    email: boolean;
  }[];
};

function toRecipient(row: Row): Recipient {
  return {
    id: row.id,
    email: row.email,
    firstName: row.profile?.firstName ?? '',
    emailVerified: row.emailVerifiedAt !== null,
    preferences: row.notificationPreferences,
  };
}

const ACTIVE = { status: 'ACTIVE', deletedAt: null } as const;

/** Everyone with an account: the audience for church-wide content. */
export async function allMembers(db: DatabaseClient): Promise<Recipient[]> {
  const rows = await db.user.findMany({ where: ACTIVE, select: RECIPIENT_SELECT });
  return rows.map(toRecipient);
}

/** Active members of one branch: the audience for that branch's content. */
export async function branchMembers(db: DatabaseClient, branchId: string): Promise<Recipient[]> {
  const rows = await db.user.findMany({
    where: { ...ACTIVE, memberships: { some: { branchId, status: 'ACTIVE' } } },
    select: RECIPIENT_SELECT,
  });
  return rows.map(toRecipient);
}

/**
 * People who hold `permission` for `branchId` (or church-wide when it is null), e.g. the
 * reviewers of a membership request or the people who follow up baptism enquiries.
 */
export async function withPermission(
  db: DatabaseClient,
  organizationId: string,
  permission: Permission,
  branchId: string | null,
): Promise<Recipient[]> {
  const now = new Date();
  const rows = await db.user.findMany({
    where: {
      ...ACTIVE,
      roleAssignments: {
        some: {
          organizationId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          // A church-wide grant satisfies every target; a branch grant only its own.
          ...(branchId ? { AND: [{ OR: [{ branchId: null }, { branchId }] }] } : {}),
          role: { permissions: { some: { permission } } },
        },
      },
    },
    select: RECIPIENT_SELECT,
  });
  return rows.map(toRecipient);
}

/** One person, when the event concerns only them. */
export async function oneUser(db: DatabaseClient, userId: string): Promise<Recipient[]> {
  const row = await db.user.findFirst({
    where: { id: userId, ...ACTIVE },
    select: RECIPIENT_SELECT,
  });
  return row ? [toRecipient(row)] : [];
}
