'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { BaptismRequestCreate } from '@church/shared';
import { Alert } from '@church/ui/alert';
import { Field } from '@church/ui/field';
import { Checkbox, Input, NativeSelect, Textarea } from '@church/ui/input';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { api, ensureOk } from '@/lib/api/client';
import { applyApiError } from '@/lib/forms';
import { SubmitButton } from './submit-button';

type Input = z.input<typeof BaptismRequestCreate>;
type Output = z.output<typeof BaptismRequestCreate>;

const FIELDS = ['branch', 'fullName', 'email', 'phone', 'preferredDate', 'message', 'consent'] as const;

export function BaptismRequestForm({
  branches,
  defaultBranch,
  defaults,
}: {
  branches: { slug: string; name: string }[];
  defaultBranch?: string;
  /** Prefilled from the signed-in member's profile. */
  defaults?: { fullName?: string; email?: string };
}) {
  const [formError, setFormError] = useState<string | null>(null);
  /** The API's confirmation message once the request is sent. */
  const [sentTo, setSentTo] = useState<string | null>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Input, unknown, Output>({
    resolver: zodResolver(BaptismRequestCreate),
    defaultValues: {
      branch: defaultBranch ?? '',
      fullName: defaults?.fullName ?? '',
      email: defaults?.email ?? '',
      phone: '',
      message: '',
    },
  });

  useEffect(() => {
    if (sentTo) doneRef.current?.focus();
  }, [sentTo]);

  async function submit(values: Output) {
    setFormError(null);
    try {
      const result = ensureOk(await api.POST('/api/v1/baptism-requests', { body: values }));
      setSentTo(result.message);
    } catch (error) {
      setFormError(applyApiError(error, setError, FIELDS));
    }
  }

  if (sentTo) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-success/30 bg-success-soft p-6">
        <CheckCircle2 aria-hidden="true" className="size-8 text-success" />
        <h3 ref={doneRef} tabIndex={-1} className="text-xl font-semibold focus:outline-none">
          Thank you. Your request has been sent
        </h3>
        <p className="text-muted">{sentTo}</p>
        <Link href="/events?category=baptism" className="text-sm font-medium text-link underline">
          See upcoming baptism services
        </Link>
      </div>
    );
  }

  return (
    <form method="post" onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-5">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <Field id="baptism-branch" label="Branch" error={errors.branch?.message} description="The branch that will contact you.">
        {(props) => (
          <NativeSelect {...props} {...register('branch')} defaultValue={defaultBranch ?? ''} required>
            <option value="" disabled>
              Choose a branch
            </option>
            {branches.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="baptism-name" label="Full name" error={errors.fullName?.message}>
          {(props) => <Input {...props} {...register('fullName')} defaultValue={defaults?.fullName} autoComplete="name" required />}
        </Field>
        <Field id="baptism-email" label="E-mail address" error={errors.email?.message}>
          {(props) => (
            <Input {...props} {...register('email')} defaultValue={defaults?.email} type="email" autoComplete="email" inputMode="email" required />
          )}
        </Field>
        <Field id="baptism-phone" label="Phone number" optional error={errors.phone?.message}>
          {(props) => <Input {...props} {...register('phone')} type="tel" autoComplete="tel" inputMode="tel" />}
        </Field>
        <Field id="baptism-date" label="Preferred date" optional error={errors.preferredDate?.message} description="If you have one in mind.">
          {(props) => <Input {...props} {...register('preferredDate', { setValueAs: (v: string) => v || null })} type="date" />}
        </Field>
      </div>
      <Field id="baptism-message" label="Anything you would like us to know" optional error={errors.message?.message}>
        {(props) => <Textarea {...props} {...register('message')} rows={4} />}
      </Field>
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-3">
          <Checkbox
            id="baptism-consent"
            {...register('consent')}
            aria-invalid={errors.consent ? true : undefined}
            aria-describedby={errors.consent ? 'baptism-consent-error' : undefined}
          />
          <label htmlFor="baptism-consent" className="text-sm">
            I agree that the church may use these details to contact me about baptism, as described in the{' '}
            <Link href="/privacy" className="font-medium text-link underline">
              privacy notice
            </Link>
            .
          </label>
        </div>
        {errors.consent ? (
          <p id="baptism-consent-error" role="alert" className="text-sm font-medium text-danger">
            {errors.consent.message}
          </p>
        ) : null}
      </div>
      <SubmitButton size="lg" loading={isSubmitting} className="self-start">
        Send request
      </SubmitButton>
    </form>
  );
}
