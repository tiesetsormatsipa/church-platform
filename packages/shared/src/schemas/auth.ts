import { z } from 'zod';
import { IsoDateTime, text, Uuid } from '../common.js';
import { normalizeEmail } from '../text.js';

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 256;

export const EmailAddress = z
  .email({ error: 'Enter a valid e-mail address' })
  .max(254)
  .transform(normalizeEmail);

export const NewPassword = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
  .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters`);

export const RegisterRequest = z.object({
  email: EmailAddress,
  password: NewPassword,
  firstName: text(80),
  lastName: text(80),
  acceptTerms: z.literal(true, { error: 'Please accept the terms and privacy notice' }),
});
export type RegisterRequest = z.input<typeof RegisterRequest>;

export const LoginRequest = z.object({
  email: EmailAddress,
  password: z.string().min(1, 'Enter your password').max(PASSWORD_MAX),
  rememberMe: z.boolean().default(false),
});
export type LoginRequest = z.input<typeof LoginRequest>;

export const EmailOnlyRequest = z.object({ email: EmailAddress });
export type EmailOnlyRequest = z.input<typeof EmailOnlyRequest>;

export const TokenRequest = z.object({ token: z.string().min(20).max(200) });
export type TokenRequest = z.input<typeof TokenRequest>;

export const ResetPasswordRequest = z.object({
  token: z.string().min(20).max(200),
  password: NewPassword,
});
export type ResetPasswordRequest = z.input<typeof ResetPasswordRequest>;

export const ChangePasswordRequest = z
  .object({
    currentPassword: z.string().min(1).max(PASSWORD_MAX),
    newPassword: NewPassword,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    path: ['newPassword'],
    error: 'Choose a password you have not used here',
  });
export type ChangePasswordRequest = z.input<typeof ChangePasswordRequest>;

/** One role assignment flattened to permissions (mirror of `Grant`). */
export const GrantDto = z.object({
  branchId: Uuid.nullable(),
  permissions: z.array(z.string()),
});

export const BranchRef = z.object({
  id: Uuid,
  slug: z.string(),
  name: z.string(),
});
export type BranchRef = z.infer<typeof BranchRef>;

export const SessionUser = z.object({
  id: Uuid,
  email: z.string(),
  emailVerified: z.boolean(),
  firstName: z.string(),
  lastName: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  homeBranch: BranchRef.nullable(),
  grants: z.array(GrantDto),
});
export type SessionUser = z.infer<typeof SessionUser>;

export const SessionResponse = z.object({
  user: SessionUser.nullable(),
});
export type SessionResponse = z.infer<typeof SessionResponse>;

/** Returned when the outcome must not reveal whether an account exists. */
export const AcceptedResponse = z.object({
  status: z.literal('accepted'),
  message: z.string(),
});
export type AcceptedResponse = z.infer<typeof AcceptedResponse>;

export const OkResponse = z.object({ ok: z.literal(true) });
export type OkResponse = z.infer<typeof OkResponse>;

export const DeviceSessionDto = z.object({
  id: Uuid,
  current: z.boolean(),
  userAgent: z.string().nullable(),
  ipAddress: z.string().nullable(),
  createdAt: IsoDateTime,
  lastSeenAt: IsoDateTime,
});
export type DeviceSessionDto = z.infer<typeof DeviceSessionDto>;

export const DeviceSessionList = z.object({ items: z.array(DeviceSessionDto) });

export const CsrfResponse = z.object({ token: z.string() });

/** Header and cookie names shared by the API and the web client. */
export const CSRF_HEADER = 'x-csrf-token';
