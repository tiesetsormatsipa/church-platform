import 'server-only';
import type { SessionUser } from '@church/shared';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { userApi } from './api/server';

/** The signed-in visitor for this request (null when signed out or the API is unreachable). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  try {
    const client = await userApi();
    const { data } = await client.GET('/api/v1/auth/session');
    return (data?.user as SessionUser | null | undefined) ?? null;
  } catch {
    return null;
  }
});

/** Require a session; otherwise send the visitor to sign in and come back to `path`. */
export async function requireUser(path: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(path)}`);
  return user;
}
