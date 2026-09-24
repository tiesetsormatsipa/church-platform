'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { NewPassword, PASSWORD_MIN, type SessionUser } from '@church/shared';
import { Alert } from '@church/ui/alert';
import { Field } from '@church/ui/field';
import { toast } from '@church/ui/toast';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { api, ApiError, ensureOk } from '@/lib/api/client';
import { applyApiError } from '@/lib/forms';
import { SESSION_KEY } from '@/lib/hooks/use-session';
import { PasswordInput } from './password-input';
import { SubmitButton } from '@/components/forms/submit-button';

const Schema = z
  .object({ password: NewPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], error: 'The passwords do not match' });
type Values = z.infer<typeof Schema>;

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: { password: '', confirm: '' } });

  // Keep the one-time token out of the address bar, history and Referer headers.
  useEffect(() => window.history.replaceState(null, '', '/reset-password'), []);

  async function submit(values: Values) {
    setFormError(null);
    try {
      const user = ensureOk(await api.POST('/api/v1/auth/password/reset', { body: { token, password: values.password } })) as SessionUser;
      queryClient.setQueryData(SESSION_KEY, user);
      toast({ title: 'Your password has been changed', description: 'You are now signed in.', tone: 'success' });
      router.replace('/profile');
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'TOKEN_INVALID') setExpired(true);
      else setFormError(applyApiError(error, setError, ['password']));
    }
  }

  if (expired) {
    return (
      <Alert tone="warning" title="This link has expired">
        Reset links work once and for one hour. <Link href="/forgot-password">Request a new link</Link>.
      </Alert>
    );
  }

  return (
    <form method="post" onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-5">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <Field id="reset-password" label="New password" error={errors.password?.message} description={`At least ${PASSWORD_MIN} characters.`}>
        {(props) => <PasswordInput {...props} {...register('password')} autoComplete="new-password" required />}
      </Field>
      <Field id="reset-confirm" label="Repeat the new password" error={errors.confirm?.message}>
        {(props) => <PasswordInput {...props} {...register('confirm')} autoComplete="new-password" required />}
      </Field>
      <p className="text-xs text-muted">Changing your password signs you out on every other device.</p>
      <SubmitButton size="lg" loading={isSubmitting}>
        Save new password
      </SubmitButton>
    </form>
  );
}
