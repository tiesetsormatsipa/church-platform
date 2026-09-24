'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { LoginRequest, type SessionUser } from '@church/shared';
import { Alert } from '@church/ui/alert';
import { Field } from '@church/ui/field';
import { Checkbox, Input } from '@church/ui/input';
import { toast } from '@church/ui/toast';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { api, ApiError, ensureOk } from '@/lib/api/client';
import { applyApiError } from '@/lib/forms';
import { SESSION_KEY } from '@/lib/hooks/use-session';
import { PasswordInput } from './password-input';
import { SubmitButton } from '@/components/forms/submit-button';

type Input = z.input<typeof LoginRequest>;
type Output = z.output<typeof LoginRequest>;

export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Input, unknown, Output>({ resolver: zodResolver(LoginRequest), defaultValues: { email: '', password: '', rememberMe: false } });

  async function submit(values: Output) {
    setFormError(null);
    setUnverified(null);
    try {
      const user = ensureOk(await api.POST('/api/v1/auth/login', { body: values })) as SessionUser;
      queryClient.setQueryData(SESSION_KEY, user);
      toast({ title: `Welcome back, ${user.firstName}`, tone: 'success' });
      router.replace(next);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EMAIL_NOT_VERIFIED') {
        setUnverified(values.email);
        return;
      }
      setFormError(applyApiError(error, setError, ['email', 'password']));
    }
  }

  async function resend() {
    const email = unverified ?? getValues('email');
    const { response } = await api.POST('/api/v1/auth/verify-email/resend', { body: { email } });
    if (response.ok) setResent(true);
    else toast({ title: 'Could not send the link', description: 'Please try again in a few minutes.', tone: 'error' });
  }

  return (
    <form method="post" onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-5">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      {unverified ? (
        <Alert tone="warning" title="Please confirm your e-mail address">
          {resent ? (
            <p>We have sent a new link to {unverified}. It is valid for 24 hours.</p>
          ) : (
            <p>
              Open the link we e-mailed you when you signed up.{' '}
              <button type="button" onClick={resend} className="font-medium text-link underline">
                Send a new link
              </button>
            </p>
          )}
        </Alert>
      ) : null}
      <Field id="signin-email" label="E-mail address" error={errors.email?.message}>
        {(props) => <Input {...props} {...register('email')} type="email" autoComplete="email" inputMode="email" required />}
      </Field>
      <Field id="signin-password" label="Password" error={errors.password?.message}>
        {(props) => <PasswordInput {...props} {...register('password')} autoComplete="current-password" required />}
      </Field>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Checkbox id="signin-remember" {...register('rememberMe')} className="mt-0" />
          <label htmlFor="signin-remember" className="text-sm">
            Keep me signed in
          </label>
        </div>
        <Link href="/forgot-password" className="text-sm font-medium text-link hover:underline">
          Forgot password?
        </Link>
      </div>
      <SubmitButton size="lg" loading={isSubmitting}>
        Sign in
      </SubmitButton>
    </form>
  );
}
