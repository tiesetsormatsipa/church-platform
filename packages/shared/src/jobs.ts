/**
 * Background job contracts shared by producers (API) and consumers (worker).
 * Payloads are validated on both sides; keep them small (ids, not objects).
 */
import { z } from 'zod';

export const QUEUE_NAMES = ['media', 'notifications', 'email', 'web'] as const;
export type QueueName = (typeof QUEUE_NAMES)[number];

const requestId = z.string().max(128).optional();

export const EmailMessage = z.discriminatedUnion('template', [
  z.object({
    template: z.literal('verify-email'),
    to: z.email(),
    data: z.object({ firstName: z.string(), verifyUrl: z.url() }),
  }),
  z.object({
    template: z.literal('account-exists'),
    to: z.email(),
    data: z.object({ firstName: z.string(), signInUrl: z.url(), resetUrl: z.url() }),
  }),
  z.object({
    template: z.literal('password-reset'),
    to: z.email(),
    data: z.object({
      firstName: z.string(),
      resetUrl: z.url(),
      expiresInMinutes: z.number().int(),
    }),
  }),
  z.object({
    template: z.literal('password-changed'),
    to: z.email(),
    data: z.object({ firstName: z.string() }),
  }),
  z.object({
    template: z.literal('membership-decided'),
    to: z.email(),
    data: z.object({
      firstName: z.string(),
      branchName: z.string(),
      approved: z.boolean(),
      note: z.string().nullable(),
    }),
  }),
  z.object({
    template: z.literal('notification'),
    to: z.email(),
    data: z.object({
      firstName: z.string(),
      title: z.string(),
      body: z.string().nullable(),
      url: z.url().nullable(),
      preferencesUrl: z.url(),
    }),
  }),
]);
export type EmailMessage = z.infer<typeof EmailMessage>;
export type EmailTemplate = EmailMessage['template'];

export const JOBS = {
  /** Validate and process an uploaded media object. */
  processMedia: {
    queue: 'media',
    name: 'process',
    schema: z.object({ mediaId: z.uuid(), requestId }),
  },
  /** Content became visible (published now or at its scheduled time). */
  contentPublished: {
    queue: 'notifications',
    name: 'content-published',
    schema: z.object({ contentId: z.uuid(), requestId }),
  },
  /** A membership request was approved or declined. */
  membershipDecided: {
    queue: 'notifications',
    name: 'membership-decided',
    schema: z.object({ membershipId: z.uuid(), requestId }),
  },
  /** A new membership request needs review by the branch's reviewers. */
  membershipRequested: {
    queue: 'notifications',
    name: 'membership-requested',
    schema: z.object({ membershipId: z.uuid(), requestId }),
  },
  /** Send one transactional e-mail. */
  sendEmail: {
    queue: 'email',
    name: 'send',
    schema: z.object({ message: EmailMessage, userId: z.uuid().nullable(), requestId }),
  },
  /** Ask the web app to revalidate cached data. */
  revalidateWeb: {
    queue: 'web',
    name: 'revalidate',
    schema: z.object({ tags: z.array(z.string().min(1).max(128)).min(1).max(50), requestId }),
  },
} as const satisfies Record<string, { queue: QueueName; name: string; schema: z.ZodType }>;

export type JobKey = keyof typeof JOBS;
export type JobPayload<K extends JobKey> = z.infer<(typeof JOBS)[K]['schema']>;

/** Cache tags used by the web app; the API triggers revalidation with the same helpers. */
export const CacheTags = {
  content: 'content',
  contentItem: (slug: string) => `content:${slug}`,
  branches: 'branches',
  branch: (slug: string) => `branch:${slug}`,
  organization: 'organization',
} as const;
