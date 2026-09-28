'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type AccountProfile, optionalText, SEX_LABEL, Sex, text } from '@church/shared';
import { Alert } from '@church/ui/alert';
import { Field } from '@church/ui/field';
import { Input, NativeSelect, Textarea } from '@church/ui/input';
import { toast } from '@church/ui/toast';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { api, ensureOk } from '@/lib/api/client';
import { applyApiError } from '@/lib/forms';
import { SESSION_KEY } from '@/lib/hooks/use-session';
import { SubmitButton } from '@/components/forms/submit-button';

/** An empty select or date field means "not said", which the API stores as null. */
function orBlank<T extends z.ZodType>(inner: T) {
  return z.union([z.literal(''), inner]).transform((v) => (v === '' ? null : v));
}

const Schema = z.object({
  firstName: text(80),
  lastName: text(80),
  displayName: optionalText(120),
  phone: optionalText(40),
  bio: optionalText(1000),
  sex: orBlank(Sex.schema),
  dateOfBirth: orBlank(z.iso.date()),
  baptismDate: orBlank(z.iso.date()),
  baptismPlace: optionalText(200),
  homeBranch: z.string().transform((v) => (v === '' ? null : v)),
});
type Input = z.input<typeof Schema>;
type Output = z.output<typeof Schema>;
const FIELDS = [
  'firstName',
  'lastName',
  'displayName',
  'phone',
  'bio',
  'sex',
  'dateOfBirth',
  'baptismDate',
  'baptismPlace',
  'homeBranch',
] as const;

/** Nobody was born tomorrow, and nobody was baptised tomorrow either. */
const TODAY = new Date().toISOString().slice(0, 10);

function valuesOf(profile: AccountProfile): Input {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    displayName: profile.displayName ?? '',
    phone: profile.phone ?? '',
    bio: profile.bio ?? '',
    sex: profile.sex ?? '',
    dateOfBirth: profile.dateOfBirth ?? '',
    baptismDate: profile.baptismDate ?? '',
    baptismPlace: profile.baptismPlace ?? '',
    homeBranch: profile.homeBranch?.slug ?? '',
  };
}

export function ProfileForm({
  profile,
  branches,
}: {
  profile: AccountProfile;
  branches: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Input, unknown, Output>({
    resolver: zodResolver(Schema),
    defaultValues: valuesOf(profile),
  });
  // react-hook-form sets values only after hydration; render them in the server HTML too.
  const defaults = valuesOf(profile);
  const field = (name: keyof Input) => ({ ...register(name), defaultValue: defaults[name] ?? '' });

  async function submit(values: Output) {
    setFormError(null);
    try {
      const saved = ensureOk(await api.PATCH('/api/v1/me/profile', { body: values }));
      reset(valuesOf(saved));
      await queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      toast({ title: 'Profile saved', tone: 'success' });
      router.refresh();
    } catch (error) {
      setFormError(applyApiError(error, setError, FIELDS));
    }
  }

  return (
    <form method="post" onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-5">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="profile-first" label="First name" error={errors.firstName?.message}>
          {(props) => <Input {...props} {...field('firstName')} autoComplete="given-name" />}
        </Field>
        <Field id="profile-last" label="Last name" error={errors.lastName?.message}>
          {(props) => <Input {...props} {...field('lastName')} autoComplete="family-name" />}
        </Field>
        <Field
          id="profile-display"
          label="Name shown to others"
          optional
          error={errors.displayName?.message}
          description="For example “Sis. Thandi”. Leave empty to use your full name."
        >
          {(props) => <Input {...props} {...field('displayName')} autoComplete="nickname" />}
        </Field>
        <Field
          id="profile-phone"
          label="Phone number"
          optional
          error={errors.phone?.message}
          description="Only branch leaders can see it."
        >
          {(props) => (
            <Input {...props} {...field('phone')} type="tel" autoComplete="tel" inputMode="tel" />
          )}
        </Field>
      </div>
      <Field
        id="profile-home"
        label="Branch you usually attend"
        optional
        error={errors.homeBranch?.message}
        description="Used to show you that branch first. To become a member, use the request below."
      >
        {(props) => (
          <NativeSelect {...props} {...field('homeBranch')}>
            <option value="">No preference</option>
            {branches.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="profile-sex"
          label="Brother or sister"
          optional
          error={errors.sex?.message}
          description="How the church addresses you."
        >
          {(props) => (
            <NativeSelect {...props} {...field('sex')}>
              <option value="">Rather not say</option>
              {Sex.values.map((value) => (
                <option key={value} value={value}>
                  {SEX_LABEL[value]}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field
          id="profile-dob"
          label="Date of birth"
          optional
          error={errors.dateOfBirth?.message}
          description="Only branch leaders can see it."
        >
          {(props) => <Input {...props} {...field('dateOfBirth')} type="date" max={TODAY} />}
        </Field>
        <Field
          id="profile-baptised-on"
          label="Date you were baptised"
          optional
          error={errors.baptismDate?.message}
        >
          {(props) => <Input {...props} {...field('baptismDate')} type="date" max={TODAY} />}
        </Field>
        <Field
          id="profile-baptised-at"
          label="Where you were baptised"
          optional
          error={errors.baptismPlace?.message}
        >
          {(props) => <Input {...props} {...field('baptismPlace')} />}
        </Field>
      </div>
      <Field id="profile-bio" label="About you" optional error={errors.bio?.message}>
        {(props) => <Textarea {...props} {...field('bio')} rows={3} />}
      </Field>
      <div className="flex items-center gap-3">
        <SubmitButton loading={isSubmitting} disabled={!isDirty}>
          Save changes
        </SubmitButton>
        {isDirty ? <span className="text-sm text-muted">You have unsaved changes.</span> : null}
      </div>
    </form>
  );
}
