'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { PASSWORD_MIN, RegisterRequest } from '@church/shared';
import { Alert } from '@church/ui/alert';
import { Field } from '@church/ui/field';
import { Checkbox, Input } from '@church/ui/input';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { api, ensureOk } from '@/lib/api/client';
import { applyApiError } from '@/lib/forms';
import { CheckEmail } from './check-email';
import { PasswordInput } from './password-input';
import { SubmitButton } from '@/components/forms/submit-button';

/**
 * The form asks for the password twice; the API does not, because a second copy proves
 * nothing to a server. Catching the typo belongs here, where the person can still see what
 * they typed — an unnoticed slip means an account nobody can get back into until they reset
 * it by e-mail.
 */
const SignUpFields = RegisterRequest.safeExtend({
  confirm: z.string().min(1, 'Repeat the password'),
}).refine((values) => values.password === values.confirm, {
  path: ['confirm'],
  error: 'Those passwords do not match',
});

type Input = z.input<typeof SignUpFields>;
type Output = z.output<typeof SignUpFields>;

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
    resolver: zodResolver(SignUpFields),
    defaultValues: { email: '', password: '', confirm: '', firstName: '', lastName: '' },
  });

  async function submit(values: Output) {
    setFormError(null);
    try {
      const { confirm: _confirm, ...body } = values;
      ensureOk(await api.POST('/api/v1/auth/register', { body }));
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
      <Field id="signup-confirm" label="Repeat the password" error={errors.confirm?.message}>
        {(props) => (
          <PasswordInput
            {...props}
            {...register('confirm')}
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
