'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ChangePasswordRequest, PASSWORD_MIN } from '@church/shared';
import { Alert } from '@church/ui/alert';
import { Field } from '@church/ui/field';
import { toast } from '@church/ui/toast';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { PasswordInput } from '@/components/auth/password-input';
import { api, ensureOk } from '@/lib/api/client';
import { applyApiError } from '@/lib/forms';
import { SubmitButton } from '@/components/forms/submit-button';

/** Typed twice here, as on the other two password forms; the API has no use for a copy. */
const ChangePasswordFields = ChangePasswordRequest.safeExtend({
  confirm: z.string().min(1, 'Repeat the new password'),
}).refine((values) => values.newPassword === values.confirm, {
  path: ['confirm'],
  error: 'Those passwords do not match',
});

type Input = z.input<typeof ChangePasswordFields>;
type Output = z.output<typeof ChangePasswordFields>;

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
    resolver: zodResolver(ChangePasswordFields),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });

  async function submit(values: Output) {
    setFormError(null);
    try {
      const { confirm: _confirm, ...body } = values;
      ensureOk(await api.POST('/api/v1/auth/password/change', { body }));
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
      <Field id="confirm-password" label="Repeat the new password" error={errors.confirm?.message}>
        {(props) => (
          <PasswordInput {...props} {...register('confirm')} autoComplete="new-password" />
        )}
      </Field>
      <SubmitButton loading={isSubmitting} className="self-start">
        Change password
      </SubmitButton>
    </form>
  );
}
