'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { PASSWORD_MIN, RegisterRequest } from '@church/shared';
import { Alert } from '@church/ui/alert';
import { Field } from '@church/ui/field';
import { Checkbox, Input } from '@church/ui/input';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { api, ensureOk } from '@/lib/api/client';
import { applyApiError } from '@/lib/forms';
import { CheckEmail } from './check-email';
import { PasswordInput } from './password-input';
import { SubmitButton } from '@/components/forms/submit-button';

type Input = z.input<typeof RegisterRequest>;
type Output = z.output<typeof RegisterRequest>;

const FIELDS = ['email', 'password', 'firstName', 'lastName', 'acceptTerms'] as const;

export function SignUpForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Input, unknown, Output>({
    resolver: zodResolver(RegisterRequest),
    defaultValues: { email: '', password: '', firstName: '', lastName: '' },
  });

  async function submit(values: Output) {
    setFormError(null);
    try {
      ensureOk(await api.POST('/api/v1/auth/register', { body: values }));
      setSentTo(values.email);
    } catch (error) {
      setFormError(applyApiError(error, setError, FIELDS));
    }
  }

  if (sentTo) {
    return (
      <CheckEmail title="Check your e-mail">
        <p>
          We have sent a link to <strong className="text-foreground">{sentTo}</strong>. Open it to
          confirm your address and finish creating your account.
        </p>
        <p>
          Nothing there after a few minutes? Check your spam folder, or sign in to get a new link.
        </p>
      </CheckEmail>
    );
  }

  return (
    <form method="post" onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-5">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="signup-first" label="First name" error={errors.firstName?.message}>
          {(props) => (
            <Input {...props} {...register('firstName')} autoComplete="given-name" required />
          )}
        </Field>
        <Field id="signup-last" label="Last name" error={errors.lastName?.message}>
          {(props) => (
            <Input {...props} {...register('lastName')} autoComplete="family-name" required />
          )}
        </Field>
      </div>
      <Field id="signup-email" label="E-mail address" error={errors.email?.message}>
        {(props) => (
          <Input
            {...props}
            {...register('email')}
            type="email"
            autoComplete="email"
            inputMode="email"
            required
          />
        )}
      </Field>
      <Field
        id="signup-password"
        label="Password"
        error={errors.password?.message}
        description={`At least ${PASSWORD_MIN} characters. A short sentence you will remember works well.`}
      >
        {(props) => (
          <PasswordInput
            {...props}
            {...register('password')}
            autoComplete="new-password"
            minLength={PASSWORD_MIN}
            required
          />
        )}
      </Field>
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-3">
          <Checkbox
            id="signup-terms"
            {...register('acceptTerms')}
            aria-invalid={errors.acceptTerms ? true : undefined}
            aria-describedby={errors.acceptTerms ? 'signup-terms-error' : undefined}
          />
          <label htmlFor="signup-terms" className="text-sm">
            I accept the{' '}
            <Link href="/terms" className="font-medium text-link underline">
              terms of use
            </Link>{' '}
            and the{' '}
            <Link href="/privacy" className="font-medium text-link underline">
              privacy notice
            </Link>
            .
          </label>
        </div>
        {errors.acceptTerms ? (
          <p id="signup-terms-error" role="alert" className="text-sm font-medium text-danger">
            {errors.acceptTerms.message}
          </p>
        ) : null}
      </div>
      <SubmitButton size="lg" loading={isSubmitting}>
        Create account
      </SubmitButton>
    </form>
  );
}
