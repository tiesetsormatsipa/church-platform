/**
 * The filters the sermon and song libraries share.
 *
 * "Show me another country's sermons" must not mean "I have moved there", so `country` and
 * `branch` narrow what you are reading without touching where you belong. A branch wins over
 * a country when both are given, because it is the more specific answer.
 */
import type { Prisma } from '@church/database';

export interface MediaFilterInput {
  country?: string | undefined;
  collection?: 'LOCAL' | 'TOG' | 'HOLY_CONVOCATION' | undefined;
  language?: string | undefined;
  from?: string | undefined;
  until?: string | undefined;
  year?: number | undefined;
  month?: number | undefined;
  branch?: string | undefined;
}

/** Inclusive date range, whether it was given as from/until, a year, or a year and month. */
export function dateRange(input: MediaFilterInput): { gte?: Date; lte?: Date } | null {
  if (input.year) {
    const month = input.month;
    const start = Date.UTC(input.year, month ? month - 1 : 0, 1);
    const end = month ? Date.UTC(input.year, month, 0) : Date.UTC(input.year, 11, 31);
    return { gte: new Date(start), lte: new Date(end) };
  }
  const range: { gte?: Date; lte?: Date } = {};
  if (input.from) range.gte = new Date(`${input.from}T00:00:00.000Z`);
  if (input.until) range.lte = new Date(`${input.until}T00:00:00.000Z`);
  return range.gte || range.lte ? range : null;
}

/**
 * Country narrowing. "ALL" and an absent value both mean the whole church; a named branch
 * has already narrowed things further, so the country is ignored then.
 */
export function countryWhere(input: MediaFilterInput): Prisma.ContentItemWhereInput | null {
  const code = input.country?.toUpperCase();
  if (!code || code === 'ALL' || input.branch) return null;
  // Church-wide content belongs to every country: it is what the branches all share.
  return {
    OR: [{ scope: 'GLOBAL' }, { branch: { countryCode: code } }],
  };
}

/** Collection narrowing: the branches' own material, or one of the two standing sections. */
export function collectionWhere(input: MediaFilterInput): Prisma.ContentItemWhereInput | null {
  return input.collection ? { collection: input.collection } : null;
}
