import { z } from 'zod';
import { NotificationCategory } from '../enums.js';
import { HttpUrl } from '../common.js';

/** Operational settings stored in organizations.settings (JSONB). */
export const OrganizationSettings = z.object({
  /** Whether new visitors can create accounts. */
  registrationOpen: z.boolean().default(true),
  /** Categories new accounts receive in-app notifications for. */
  defaultInAppCategories: z
    .array(NotificationCategory.schema)
    .default(['ANNOUNCEMENTS', 'EVENTS', 'BAPTISM', 'MEMBERSHIP', 'MESSAGES', 'ACCOUNT']),
  /** Categories new accounts receive e-mail for. */
  defaultEmailCategories: z.array(NotificationCategory.schema).default(['MEMBERSHIP', 'ACCOUNT']),
  socialLinks: z
    .object({
      facebook: HttpUrl.optional(),
      youtube: HttpUrl.optional(),
      instagram: HttpUrl.optional(),
      x: HttpUrl.optional(),
    })
    .default({}),
});
export type OrganizationSettings = z.infer<typeof OrganizationSettings>;

export function parseOrganizationSettings(value: unknown): OrganizationSettings {
  const result = OrganizationSettings.safeParse(value ?? {});
  return result.success ? result.data : OrganizationSettings.parse({});
}
