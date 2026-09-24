import 'server-only';
import type { AdminSummary } from '@church/shared';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { unwrap, userApi } from './api/server';
import { requireUser } from './session';

/** The signed-in user's admin areas and counts (once per request). */
export const getAdminSummary = cache(async (): Promise<AdminSummary> => {
  await requireUser('/admin');
  const client = await userApi();
  return unwrap(await client.GET('/api/v1/admin/summary'));
});

/** 404 unless the user may use `area` (the API enforces the same rules). */
export async function requireArea(area: keyof AdminSummary['areas']): Promise<AdminSummary> {
  const summary = await getAdminSummary();
  if (!summary.areas[area]) notFound();
  return summary;
}

/** Positive page number from the query string. */
export function pageParam(value: string | undefined): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 && page < 10_000 ? page : 1;
}
