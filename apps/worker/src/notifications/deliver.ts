/**
 * Turns one event into notifications for many people.
 *
 * Each recipient's choice decides the channels: an in-app row, an e-mail, both or neither.
 * Where a member has expressed no preference for a category, the organisation defaults
 * apply, and security notices (`ACCOUNT`) are always e-mailed.
 *
 * Idempotency: every notification carries a `dedupeKey` unique per user, so a retry of the
 * same job inserts nothing the second time. E-mail is only enqueued for rows this run
 * actually created, so a retry does not send a second copy either.
 */
import {
  MANDATORY_EMAIL_CATEGORIES,
  type NotificationCategory,
  type OrganizationSettings,
} from '@church/shared';
import type { JobContext } from '../runtime.js';

export interface Recipient {
  id: string;
  email: string;
  firstName: string;
  emailVerified: boolean;
  preferences: { category: NotificationCategory; inApp: boolean; email: boolean }[];
}

export interface NotificationDraft {
  category: NotificationCategory;
  title: string;
  body: string | null;
  /** App-relative path; the e-mail turns it into an absolute URL. */
  path: string | null;
  /** Unique per user, e.g. "content-published:<id>". */
  dedupeKey: string;
}

/** Rows written per statement. Large fan-outs stay off a single huge insert. */
const BATCH_SIZE = 500;

/** BullMQ forbids ":" in a custom job id, and its ids are capped in practice. */
function jobId(parts: string): string {
  return parts.replace(/:/g, '-').slice(0, 180);
}

function wants(
  recipient: Recipient,
  category: NotificationCategory,
  settings: OrganizationSettings,
): { inApp: boolean; email: boolean } {
  const chosen = recipient.preferences.find((p) => p.category === category);
  const mandatory = (MANDATORY_EMAIL_CATEGORIES as readonly string[]).includes(category);
  return {
    inApp: chosen?.inApp ?? settings.defaultInAppCategories.includes(category),
    email: mandatory || (chosen?.email ?? settings.defaultEmailCategories.includes(category)),
  };
}

export interface DeliveryResult {
  created: number;
  emailed: number;
}

export interface DeliverOptions {
  /**
   * Skip the generic notification e-mail. Used where a dedicated template says more than
   * the generic one and the caller sends that instead, so nobody gets two messages.
   */
  skipEmail?: boolean;
}

/**
 * Writes the in-app notifications and enqueues the e-mails.
 *
 * `draft` may depend on the recipient (for a personal message); pass a function then.
 */
export async function deliver(
  context: JobContext,
  recipients: Recipient[],
  draft: NotificationDraft | ((recipient: Recipient) => NotificationDraft),
  options: DeliverOptions = {},
): Promise<DeliveryResult> {
  if (recipients.length === 0) return { created: 0, emailed: 0 };
  const organization = await context.organization();
  const settings = organization.settings;
  const draftFor = typeof draft === 'function' ? draft : () => draft;

  let created = 0;
  let emailed = 0;

  for (let offset = 0; offset < recipients.length; offset += BATCH_SIZE) {
    const batch = recipients.slice(offset, offset + BATCH_SIZE);
    const rows: {
      userId: string;
      category: NotificationCategory;
      title: string;
      body: string | null;
      url: string | null;
      dedupeKey: string;
    }[] = [];
    const mailTo: { recipient: Recipient; draft: NotificationDraft }[] = [];

    for (const recipient of batch) {
      const item = draftFor(recipient);
      const channels = wants(recipient, item.category, settings);
      if (channels.inApp) {
        rows.push({
          userId: recipient.id,
          category: item.category,
          title: item.title,
          body: item.body,
          url: item.path,
          dedupeKey: item.dedupeKey,
        });
      }
      // Never send bulk mail to an address nobody has confirmed.
      if (channels.email && recipient.emailVerified && !options.skipEmail) {
        mailTo.push({ recipient, draft: item });
      }
    }

    if (rows.length > 0) {
      const result = await context.db.notification.createMany({ data: rows, skipDuplicates: true });
      created += result.count;
    }

    for (const { recipient, draft: item } of mailTo) {
      // One job per message: a bad address must not stop the rest of the fan-out.
      await context.jobs.enqueue(
        'sendEmail',
        {
          message: {
            template: 'notification',
            to: recipient.email,
            data: {
              firstName: recipient.firstName,
              title: item.title,
              body: item.body,
              url: item.path ? context.link(item.path) : null,
              preferencesUrl: context.link('/profile/notifications'),
            },
          },
          userId: recipient.id,
        },
        // Deterministic id: a retry of the fan-out reuses it, so BullMQ drops the duplicate.
        { jobId: jobId(`n-${item.dedupeKey}-${recipient.id}`) },
      );
      emailed += 1;
    }
  }

  return { created, emailed };
}
