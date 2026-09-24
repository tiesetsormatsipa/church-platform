'use client';

import { type AdminBranchDetail, BRANCH_TYPE_LABEL, BranchInput, BranchType } from '@church/shared';
import { Alert } from '@church/ui/alert';
import { Field } from '@church/ui/field';
import { Input, NativeSelect, Textarea } from '@church/ui/input';
import { toast } from '@church/ui/toast';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { type FieldPath, useForm } from 'react-hook-form';
import { SubmitButton } from '@/components/forms/submit-button';
import { api, ApiError, ensureOk } from '@/lib/api/client';

interface Values {
  name: string;
  type: string;
  parentBranch: string;
  description: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  postalCode: string;
  countryCode: string;
  latitude: string;
  longitude: string;
  mapsUrl: string;
  phone: string;
  email: string;
  sortOrder: string;
}

function valuesOf(branch: AdminBranchDetail | null): Values {
  return {
    name: branch?.name ?? '',
    type: branch?.type ?? 'MAIN',
    parentBranch: branch?.parentBranch?.slug ?? '',
    description: branch?.description ?? '',
    addressLine1: branch?.addressLine1 ?? '',
    addressLine2: branch?.addressLine2 ?? '',
    city: branch?.city ?? '',
    province: branch?.province ?? '',
    postalCode: branch?.postalCode ?? '',
    countryCode: branch?.countryCode ?? 'ZA',
    latitude: branch?.latitude?.toString() ?? '',
    longitude: branch?.longitude?.toString() ?? '',
    mapsUrl: branch?.mapsUrl ?? '',
    phone: branch?.phone ?? '',
    email: branch?.email ?? '',
    sortOrder: String(branch?.sortOrder ?? 0),
  };
}

const num = (v: string) => (v.trim() === '' ? null : Number(v));
const orNull = (v: string) => (v.trim() === '' ? null : v.trim());

/** Create or edit a branch's details. */
export function BranchForm({
  branch,
  parents,
}: {
  branch: AdminBranchDetail | null;
  parents: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const defaults = valuesOf(branch);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Values>({ defaultValues: defaults });
  const field = (name: keyof Values) => ({ ...register(name), defaultValue: defaults[name] });

  async function submit(values: Values) {
    setFormError(null);
    const parsed = BranchInput.safeParse({
      ...values,
      parentBranch: orNull(values.parentBranch),
      latitude: num(values.latitude),
      longitude: num(values.longitude),
      mapsUrl: orNull(values.mapsUrl),
      email: orNull(values.email),
      countryCode: values.countryCode.toUpperCase(),
      sortOrder: Number(values.sortOrder) || 0,
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues)
        setError(issue.path.join('.') as FieldPath<Values>, { message: issue.message });
      setFormError('Please check the highlighted fields.');
      return;
    }
    try {
      const saved = branch
        ? ensureOk(
            await api.PUT('/api/v1/admin/branches/{slug}', {
              params: { path: { slug: branch.slug } },
              body: parsed.data,
            }),
          )
        : ensureOk(await api.POST('/api/v1/admin/branches', { body: parsed.data }));
      reset(valuesOf(saved));
      toast({ title: branch ? 'Branch saved' : 'Branch created', tone: 'success' });
      if (!branch) router.replace(`/admin/branches/${saved.slug}`);
      else router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        for (const e of error.fieldErrors)
          setError(e.path as FieldPath<Values>, { message: e.message });
        setFormError(error.message);
      } else setFormError('We could not reach the server. Please try again.');
    }
  }

  const err = (name: keyof Values) => errors[name]?.message;

  return (
    <form method="post" onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-5">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="branch-name" label="Name" error={err('name')}>
          {(props) => <Input {...props} {...field('name')} />}
        </Field>
        <Field id="branch-type" label="Kind" error={err('type')}>
          {(props) => (
            <NativeSelect {...props} {...field('type')}>
              {BranchType.values.map((t) => (
                <option key={t} value={t}>
                  {t === 'MAIN' ? 'Branch' : BRANCH_TYPE_LABEL[t]}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field id="branch-parent" label="Part of" optional error={err('parentBranch')}>
          {(props) => (
            <NativeSelect {...props} {...field('parentBranch')}>
              <option value="">Not part of another branch</option>
              {parents
                .filter((p) => p.slug !== branch?.slug)
                .map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.name}
                  </option>
                ))}
            </NativeSelect>
          )}
        </Field>
        <Field
          id="branch-order"
          label="Position in lists"
          error={err('sortOrder')}
          description="Lower numbers come first."
        >
          {(props) => (
            <Input {...props} {...field('sortOrder')} type="number" min={0} inputMode="numeric" />
          )}
        </Field>
      </div>
      <Field
        id="branch-description"
        label="About the branch"
        optional
        error={err('description')}
        description="Shown on the branch page. Markdown is allowed."
      >
        {(props) => <Textarea {...props} {...field('description')} rows={4} />}
      </Field>
      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-semibold">Address and contact</legend>
        <Field id="branch-address1" label="Street address" optional error={err('addressLine1')}>
          {(props) => <Input {...props} {...field('addressLine1')} autoComplete="off" />}
        </Field>
        <Field id="branch-address2" label="Suburb or building" optional error={err('addressLine2')}>
          {(props) => <Input {...props} {...field('addressLine2')} autoComplete="off" />}
        </Field>
        <Field id="branch-city" label="City or town" optional error={err('city')}>
          {(props) => <Input {...props} {...field('city')} />}
        </Field>
        <Field id="branch-province" label="Province" optional error={err('province')}>
          {(props) => <Input {...props} {...field('province')} />}
        </Field>
        <Field id="branch-postal" label="Postal code" optional error={err('postalCode')}>
          {(props) => <Input {...props} {...field('postalCode')} inputMode="numeric" />}
        </Field>
        <Field
          id="branch-country"
          label="Country code"
          error={err('countryCode')}
          description="Two letters, for example ZA."
        >
          {(props) => (
            <Input {...props} {...field('countryCode')} maxLength={2} className="uppercase" />
          )}
        </Field>
        <Field
          id="branch-maps"
          label="Map link"
          optional
          error={err('mapsUrl')}
          description="A Google Maps link to the entrance."
        >
          {(props) => (
            <Input
              {...props}
              {...field('mapsUrl')}
              type="url"
              inputMode="url"
              placeholder="https://"
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="branch-lat" label="Latitude" optional error={err('latitude')}>
            {(props) => <Input {...props} {...field('latitude')} inputMode="decimal" />}
          </Field>
          <Field id="branch-lng" label="Longitude" optional error={err('longitude')}>
            {(props) => <Input {...props} {...field('longitude')} inputMode="decimal" />}
          </Field>
        </div>
        <Field id="branch-phone" label="Phone" optional error={err('phone')}>
          {(props) => <Input {...props} {...field('phone')} type="tel" inputMode="tel" />}
        </Field>
        <Field id="branch-email" label="E-mail" optional error={err('email')}>
          {(props) => <Input {...props} {...field('email')} type="email" inputMode="email" />}
        </Field>
      </fieldset>
      <SubmitButton
        loading={isSubmitting}
        disabled={branch !== null && !isDirty}
        className="self-start"
      >
        {branch ? 'Save details' : 'Create branch'}
      </SubmitButton>
    </form>
  );
}
