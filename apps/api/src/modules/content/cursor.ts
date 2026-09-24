import { z } from 'zod';
import { Errors } from '../../common/http/errors.js';

const CursorShape = z.tuple([z.string().min(1).max(40), z.uuid()]);

/** Opaque keyset cursor: the sort key and id of the last item of a page. */
export function encodeCursor(sortKey: Date | string, id: string): string {
  const key = sortKey instanceof Date ? sortKey.toISOString() : sortKey;
  return Buffer.from(JSON.stringify([key, id])).toString('base64url');
}

export function decodeCursor(cursor: string | undefined): { key: string; id: string } | null {
  if (!cursor) return null;
  try {
    const [key, id] = CursorShape.parse(
      JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')),
    );
    return { key, id };
  } catch {
    throw Errors.badRequest(
      'INVALID_CURSOR',
      'The page cursor is invalid. Start again from the first page.',
    );
  }
}

/** Split an over-fetched page (limit + 1 rows) into items and the next cursor. */
export function paginate<T>(rows: T[], limit: number, cursorOf: (last: T) => string) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  return { items, nextCursor: hasMore && last ? cursorOf(last) : null };
}
