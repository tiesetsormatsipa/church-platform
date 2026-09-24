'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { EmailOnlyRequest } from '@church/shared';
import { Alert } from '@church/ui/alert';
import { Field } from '@church/ui/field';
import { Input } from '@church/ui/input';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { api, ensureOk } from '@/lib/api/client';
import { applyApiError } from '@/lib/forms';
import { CheckEmail } from './check-email';
import { SubmitButton } from '@/components/forms/submit-button';

type Input = z.input<typeof EmailOnlyRequest>;
type Output = z.output<typeof EmailOnlyRequest>;

export function ForgotPasswordForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Input, unknown, Output>({
    resolver: zodResolver(EmailOnlyRequest),
    defaultValues: { email: '' },
  });

  async function submit(values: Output) {
    setFormError(null);
    try {
      ensureOk(await api.POST('/api/v1/auth/password/forgot', { body: values }));
      setSentTo(values.email);
    } catch (error) {
      setFormError(applyApiError(error, setError, ['email']));
    }
  }

  if (sentTo) {
    return (
      <CheckEmail title="Check your e-mail">
        <p>
          If an account exists for <strong className="text-foreground">{sentTo}</strong>, we have
          sent a link to choose a new password. It is valid for one hour.
        </p>
      </CheckEmail>
    );
  }

  return (
    <form method="post" onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-5">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <Field id="forgot-email" label="E-mail address" error={errors.email?.message}>
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
      <SubmitButton size="lg" loading={isSubmitting}>
        Send reset link
      </SubmitButton>
    </form>
  );
}
