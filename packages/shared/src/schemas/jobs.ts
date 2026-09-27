/**
 * The jobs board.
 *
 * A posting is a `ContentItem` of type `JOB` with a `JobDetail` beside it, so it goes
 * through the same draft → review → publish workflow as everything else the church shows.
 * What is different is who writes them: any member may put an opening forward, and a
 * reviewer reads it before anyone else does. Editing a published posting sends it back for
 * review, because the whole point is that nothing reaches the board unread.
 */
import { z } from 'zod';
import { HttpUrl, IsoDate, IsoDateTime, optionalText, text, Uuid } from '../common.js';
import { ContentStatus, EmploymentType } from '../enums.js';
import { EmailAddress } from './auth.js';

export const JOB_BODY_MAX = 8000;

/** Exactly one way to apply, matching the CHECK constraint on `job_details`. */
const applyWay = {
  applyEmail: EmailAddress.nullish(),
  applyUrl: HttpUrl.nullish(),
};

function oneWayToApply<T extends { applyEmail?: string | null; applyUrl?: string | null }>(
  value: T,
  ctx: z.RefinementCtx,
) {
  const hasEmail = Boolean(value.applyEmail);
  const hasUrl = Boolean(value.applyUrl);
  if (hasEmail === hasUrl) {
    ctx.addIssue({
      code: 'custom',
      path: ['applyEmail'],
      message: 'Give either an e-mail address or a link to apply, not both.',
    });
  }
}

export const JobDetailDto = z.object({
  employerName: z.string(),
  location: z.string(),
  employmentType: EmploymentType.schema,
  salaryRange: z.string().nullable(),
  applyEmail: z.string().nullable(),
  applyUrl: z.string().nullable(),
  applyNote: z.string().nullable(),
  closesOn: IsoDate.nullable(),
  /** True once `closesOn` is in the past; the board hides these. */
  closed: z.boolean(),
});
export type JobDetailDto = z.infer<typeof JobDetailDto>;

export const JobSummary = z.object({
  id: Uuid,
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  publishedAt: IsoDateTime.nullable(),
  postedBy: z.string().nullable(),
  job: JobDetailDto,
});
export type JobSummary = z.infer<typeof JobSummary>;

export const JobsPage = z
  .object({ items: z.array(JobSummary), nextCursor: z.string().nullable() })
  .meta({ id: 'JobsPage' });
export type JobsPage = z.infer<typeof JobsPage>;

export const JobDetailPage = JobSummary.extend({
  body: z.string().nullable(),
}).meta({ id: 'JobDetailPage' });
export type JobDetailPage = z.infer<typeof JobDetailPage>;

export const JobsQuery = z.object({
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  employmentType: EmploymentType.schema.optional(),
  /** Town or city, matched loosely. */
  where: text(100).optional(),
  q: text(100).optional(),
});
export type JobsQuery = z.input<typeof JobsQuery>;

const jobFields = {
  title: text(200),
  summary: optionalText(500),
  body: optionalText(JOB_BODY_MAX),
  employerName: text(200),
  location: text(200),
  employmentType: EmploymentType.schema,
  salaryRange: optionalText(120),
  applyNote: optionalText(500),
  closesOn: IsoDate.nullish(),
  ...applyWay,
};

export const CreateJobPosting = z
  .object(jobFields)
  .superRefine(oneWayToApply)
  .meta({ id: 'CreateJobPosting' });
export type CreateJobPosting = z.input<typeof CreateJobPosting>;

export const UpdateJobPosting = z
  .object(jobFields)
  .superRefine(oneWayToApply)
  .meta({ id: 'UpdateJobPosting' });
export type UpdateJobPosting = z.input<typeof UpdateJobPosting>;

/** A posting as its author sees it, whatever state it is in. */
export const MyJobPosting = JobSummary.extend({
  body: z.string().nullable(),
  status: ContentStatus.schema,
  updatedAt: IsoDateTime,
  /** The author may edit and withdraw until it is archived. */
  canEdit: z.boolean(),
});
export type MyJobPosting = z.infer<typeof MyJobPosting>;

export const MyJobPostings = z
  .object({ items: z.array(MyJobPosting) })
  .meta({ id: 'MyJobPostings' });
export type MyJobPostings = z.infer<typeof MyJobPostings>;
