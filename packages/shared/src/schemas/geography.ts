/**
 * The church's geography, and the baptism numbers that hang off it.
 *
 * One branch tree of arbitrary depth (see docs/ROADMAP_V2.md §1): a branch's parent may be in
 * another country, which is how "Namibia falls under Johannesburg" is expressed without a
 * separate relationship. Totals therefore come in two flavours that can legitimately differ:
 * `own` (this branch alone) and `total` (this branch plus everything beneath it).
 */
import { z } from 'zod';
import { IsoDate, IsoDateTime, Slug, Uuid, optionalText } from '../common.js';
import { BranchStatus, BranchType } from '../enums.js';

/** ISO 3166-1 alpha-2. Stored upper case. */
export const CountryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(2, 'Use a two-letter country code')
  .regex(/^[A-Z]{2}$/, 'Use a two-letter country code');

export const BaptismTotals = z.object({
  /** Baptisms recorded against this branch alone. */
  own: z.number().int(),
  /** This branch and every branch beneath it in the tree. */
  total: z.number().int(),
});
export type BaptismTotals = z.infer<typeof BaptismTotals>;

/** A branch as the globe and the branch pages need it. */
export const GeoBranch = z.object({
  id: Uuid,
  slug: Slug,
  name: z.string(),
  type: BranchType.schema,
  status: BranchStatus.schema,
  countryCode: z.string(),
  city: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  parentBranchId: Uuid.nullable(),
  /** Depth in the tree: 0 for a branch with no parent. */
  depth: z.number().int(),
  /** Active members who worship here. */
  members: z.number().int(),
  baptisms: BaptismTotals,
});
export type GeoBranch = z.infer<typeof GeoBranch>;

export const GeoCountry = z.object({
  code: z.string(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  /** Degrees on the colour wheel; every branch of the country is drawn with it. */
  hue: z.number().int(),
  branchCount: z.number().int(),
  mainBranchCount: z.number().int(),
  members: z.number().int(),
  baptisms: z.number().int(),
});
export type GeoCountry = z.infer<typeof GeoCountry>;

/** Everything the globe needs in one request. */
export const GeographyOverview = z
  .object({
    countries: z.array(GeoCountry),
    branches: z.array(GeoBranch),
    totals: z.object({
      countries: z.number().int(),
      branches: z.number().int(),
      members: z.number().int(),
      baptisms: z.number().int(),
    }),
  })
  .meta({ id: 'GeographyOverview' });
export type GeographyOverview = z.infer<typeof GeographyOverview>;

/** Baptism totals for the home page: the whole church, this year, and by country. */
export const BaptismSummary = z
  .object({
    /** Every baptism ever recorded. */
    allTime: z.number().int(),
    /** The year the `year` figures cover. */
    year: z.number().int(),
    yearTotal: z.number().int(),
    countries: z.array(
      z.object({
        code: z.string(),
        name: z.string(),
        hue: z.number().int(),
        allTime: z.number().int(),
        yearTotal: z.number().int(),
      }),
    ),
    /** Totals per year, newest first, so a chart can be drawn without another request. */
    years: z.array(z.object({ year: z.number().int(), total: z.number().int() })),
  })
  .meta({ id: 'BaptismSummary' });
export type BaptismSummary = z.infer<typeof BaptismSummary>;

export const BaptismSummaryQuery = z.object({
  /** Which year the `yearTotal` figures cover. Defaults to the current year. */
  year: z.coerce.number().int().min(1900).max(2999).optional(),
});
export type BaptismSummaryQuery = z.input<typeof BaptismSummaryQuery>;

// ---------------------------------------------------------------------------
// Recording baptisms (administration)
// ---------------------------------------------------------------------------

export const BaptismRecordDto = z
  .object({
    id: Uuid,
    branch: z.object({ id: Uuid, slug: Slug, name: z.string() }),
    occurredOn: IsoDate,
    count: z.number().int(),
    note: z.string().nullable(),
    recordedBy: z.string().nullable(),
    createdAt: IsoDateTime,
  })
  .meta({ id: 'BaptismRecordDto' });
export type BaptismRecordDto = z.infer<typeof BaptismRecordDto>;

/** A branch adds to its number after a service. */
export const CreateBaptismRecord = z
  .object({
    branch: Slug,
    occurredOn: IsoDate,
    count: z.coerce
      .number({ error: 'How many people were baptised?' })
      .int('Use a whole number')
      .min(1, 'Use at least 1')
      .max(10_000, 'That looks too high; split it across entries'),
    note: optionalText(500),
  })
  .meta({ id: 'CreateBaptismRecord' });
export type CreateBaptismRecord = z.input<typeof CreateBaptismRecord>;

export const UpdateBaptismRecord = CreateBaptismRecord.partial({
  branch: true,
  occurredOn: true,
  count: true,
}).meta({ id: 'UpdateBaptismRecord' });
export type UpdateBaptismRecord = z.input<typeof UpdateBaptismRecord>;

export const BaptismRecordList = z
  .object({ items: z.array(BaptismRecordDto) })
  .meta({ id: 'BaptismRecordList' });
export type BaptismRecordList = z.infer<typeof BaptismRecordList>;

export const BaptismRecordsQuery = z.object({ branch: Slug });
export type BaptismRecordsQuery = z.input<typeof BaptismRecordsQuery>;

export const DeletedBaptismRecord = z.object({ id: Uuid }).meta({ id: 'DeletedBaptismRecord' });
export type DeletedBaptismRecord = z.infer<typeof DeletedBaptismRecord>;
