/** Building blocks reused by the API contracts. */
import { z } from 'zod';

export const Uuid = z.uuid();

export const Slug = z
  .string({ error: 'This field is required' })
  .min(1, 'This field is required')
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lower-case letters, numbers and single hyphens');

/** Opaque cursor for keyset pagination. */
export const Cursor = z.string().max(512);

export const CursorPageQuery = z.object({
  cursor: Cursor.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type CursorPageQuery = z.infer<typeof CursorPageQuery>;

export const OffsetPageQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type OffsetPageQuery = z.infer<typeof OffsetPageQuery>;

export function cursorPage<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
}

export function offsetPage<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  });
}

/** ISO 8601 timestamp string as serialised in JSON responses. */
export const IsoDateTime = z.iso.datetime({ offset: true });
/** Calendar date `YYYY-MM-DD`. */
export const IsoDate = z.iso.date();
/** Wall-clock time `HH:MM` (24h). */
export const TimeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24-hour)');

/** Trimmed, non-empty single-line text. */
export function text(max: number, min = 1) {
  return z
    .string({ error: 'This field is required' })
    .trim()
    .min(min, min === 1 ? 'This field is required' : `Use at least ${min} characters`)
    .max(max, `Use at most ${max} characters`);
}

/** Optional text where an empty string means "not set". */
export function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters`)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();
}

/** http(s) URL only (blocks javascript:, data:, etc.). */
export const HttpUrl = z.url({ protocol: /^https?$/ }).max(2048);

/** RFC 9457 problem details returned by the API on errors. */
export const ProblemDetails = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  code: z.string().optional(),
  requestId: z.string().optional(),
  errors: z
    .array(z.object({ path: z.string(), message: z.string() }))
    .optional(),
});
export type ProblemDetails = z.infer<typeof ProblemDetails>;
