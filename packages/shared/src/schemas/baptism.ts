import { z } from 'zod';
import { IsoDate, optionalText, Slug, text } from '../common.js';
import { EmailAddress } from './auth.js';

export const BaptismRequestCreate = z
  .object({
    branch: Slug,
    fullName: text(160),
    email: EmailAddress,
    phone: optionalText(40),
    preferredDate: IsoDate.nullable().optional(),
    message: optionalText(2000),
    consent: z.literal(true, { error: 'Please agree so that the branch can contact you' }),
  })
  .meta({ id: 'BaptismRequestCreate' });
export type BaptismRequestCreate = z.input<typeof BaptismRequestCreate>;
