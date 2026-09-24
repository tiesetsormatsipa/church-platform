import type { DatabaseClient, Prisma } from '@church/database';
import { type Grant, isPermission, type PersonRef } from '@church/shared';

export const PERSON_SELECT = {
  id: true,
  email: true,
  profile: { select: { firstName: true, lastName: true, displayName: true } },
} satisfies Prisma.UserSelect;

export type PersonRow = Prisma.UserGetPayload<{ select: typeof PERSON_SELECT }>;

export function personName(user: PersonRow): string {
  const p = user.profile;
  return (p && (p.displayName || `${p.firstName} ${p.lastName}`.trim())) || user.email;
}

export function personRef(user: PersonRow): PersonRef {
  return { id: user.id, name: personName(user), email: user.email };
}

/** Current grants of any user (same rules as the session principal). */
export async function grantsFor(
  db: DatabaseClient,
  userId: string,
  organizationId: string,
): Promise<Grant[]> {
  const assignments = await db.roleAssignment.findMany({
    where: {
      userId,
      organizationId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { branchId: true, role: { select: { permissions: { select: { permission: true } } } } },
  });
  return assignments.map((a) => ({
    branchId: a.branchId,
    permissions: a.role.permissions.map((p) => p.permission).filter(isPermission),
  }));
}

/** Prisma filter for rows in branches where a scope applies (`ALL` = no restriction). */
export function inScope(scope: 'ALL' | string[]): { branchId?: { in: string[] } } {
  return scope === 'ALL' ? {} : { branchId: { in: scope } };
}
