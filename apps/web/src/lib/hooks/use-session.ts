'use client';

import { canAnywhere, type Grant, type SessionUser } from '@church/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { grantsOfUser } from '../grants';

export const SESSION_KEY = ['session'] as const;

async function fetchSession(): Promise<SessionUser | null> {
  const { data, response } = await api.GET('/api/v1/auth/session');
  if (!response.ok || !data) return null;
  return data.user as SessionUser | null;
}

/** The signed-in user (or null). Shared by every client island through TanStack Query. */
export function useSession() {
  const query = useQuery({ queryKey: SESSION_KEY, queryFn: fetchSession, staleTime: 60_000 });
  return { user: query.data ?? null, isLoading: query.isPending };
}

export function useSetSession() {
  const client = useQueryClient();
  return (user: SessionUser | null) => client.setQueryData(SESSION_KEY, user);
}

export function grantsOf(user: SessionUser | null): Grant[] {
  return grantsOfUser(user);
}

/** Whether to offer the admin area (the API still enforces every action). */
export function hasAdminAccess(user: SessionUser | null): boolean {
  const grants = grantsOf(user);
  return (['content.create', 'membership.review', 'branch.update', 'user.read'] as const).some(
    (p) => canAnywhere(grants, p),
  );
}
