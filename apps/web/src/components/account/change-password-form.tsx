'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ChangePasswordRequest, PASSWORD_MIN } from '@church/shared';
import { Alert } from '@church/ui/alert';
import { Field } from '@church/ui/field';
import { toast } from '@church/ui/toast';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { PasswordInput } from '@/components/auth/password-input';
import { api, ensureOk } from '@/lib/api/client';
import { applyApiError } from '@/lib/forms';
import { SubmitButton } from '@/components/forms/submit-button';

type Input = z.input<typeof ChangePasswordRequest>;
type Output = z.output<typeof ChangePasswordRequest>;

export function ChangePasswordForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Input, unknown, Output>({
    resolver: zodResolver(ChangePasswordRequest),
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  async function submit(values: Output) {
    setFormError(null);
    try {
      ensureOk(await api.POST('/api/v1/auth/password/change', { body: values }));
      reset();
      toast({
        title: 'Password changed',
        description: 'Other devices have been signed out.',
        tone: 'success',
      });
      router.refresh();
    } catch (error) {
      setFormError(applyApiError(error, setError, ['currentPassword', 'newPassword']));
    }
  }

  return (
    <form
      method="post"
      onSubmit={handleSubmit(submit)}
      noValidate
      className="flex max-w-md flex-col gap-5"
    >
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <Field id="current-password" label="Current password" error={errors.currentPassword?.message}>
        {(props) => (
          <PasswordInput
            {...props}
            {...register('currentPassword')}
            autoComplete="current-password"
          />
        )}
      </Field>
      <Field
        id="new-password"
        label="New password"
        error={errors.newPassword?.message}
        description={`At least ${PASSWORD_MIN} characters.`}
      >
        {(props) => (
          <PasswordInput {...props} {...register('newPassword')} autoComplete="new-password" />
        )}
      </Field>
      <SubmitButton loading={isSubmitting} className="self-start">
        Change password
      </SubmitButton>
    </form>
  );
}
