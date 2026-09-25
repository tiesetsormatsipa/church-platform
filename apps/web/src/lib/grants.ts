import { type Grant, isPermission, type SessionUser } from '@church/shared';

/** Grants of a session user, for deciding which controls to show (the API enforces). */
export function grantsOfUser(user: SessionUser | null): Grant[] {
  return (user?.grants ?? []).map((g) => ({
    branchId: g.branchId,
    permissions: g.permissions.filter(isPermission),
    rank: g.rank,
    contentTypes: g.contentTypes,
  }));
}
