'use client';

import {
  type AdminOrganization,
  NOTIFICATION_CATEGORY_LABEL,
  NotificationCategory,
  OrganizationSettingsInput,
} from '@church/shared';
import { Alert } from '@church/ui/alert';
import { Field } from '@church/ui/field';
import { Checkbox, Input, Textarea } from '@church/ui/input';
import { toast } from '@church/ui/toast';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SubmitButton } from '@/components/forms/submit-button';
import { api, ApiError, ensureOk } from '@/lib/api/client';

type Category = (typeof NotificationCategory.values)[number];

/** Church name, contact details, public switches and notification defaults. */
export function SettingsForm({ settings }: { settings: AdminOrganization }) {
  const router = useRouter();
  const [values, setValues] = useState(settings);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const text = (
    key:
      | 'name'
      | 'shortName'
      | 'tagline'
      | 'description'
      | 'email'
      | 'phone'
      | 'websiteUrl'
      | 'timezone',
  ) => ({
    value: values[key] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [key]: e.target.value })),
  });
  const social = (key: keyof AdminOrganization['socialLinks']) => ({
    value: values.socialLinks[key] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setValues((v) => ({ ...v, socialLinks: { ...v.socialLinks, [key]: e.target.value } })),
  });
  const toggleCategory = (
    list: 'defaultInAppCategories' | 'defaultEmailCategories',
    category: Category,
  ) =>
    setValues((v) => ({
      ...v,
      [list]: v[list].includes(category)
        ? v[list].filter((c) => c !== category)
        : [...v[list], category],
    }));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const orNull = (s: string | null) => (s && s.trim() ? s.trim() : null);
    const parsed = OrganizationSettingsInput.safeParse({
      ...values,
      email: orNull(values.email),
      websiteUrl: orNull(values.websiteUrl),
      socialLinks: Object.fromEntries(
        Object.entries(values.socialLinks).map(([k, v]) => [k, orNull(v)]),
      ),
    });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])));
      setFormError('Please check the highlighted fields.');
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const saved = ensureOk(await api.PUT('/api/v1/admin/settings', { body: parsed.data }));
      setValues(saved);
      toast({ title: 'Settings saved', tone: 'success' });
      router.refresh();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form method="post" onSubmit={save} noValidate className="flex flex-col gap-8">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-3 text-base font-semibold">The church</legend>
        <Field id="org-name" label="Full name" error={errors.name}>
          {(props) => <Input {...props} {...text('name')} />}
        </Field>
        <Field
          id="org-short"
          label="Short name"
          optional
          error={errors.shortName}
          description="Shown in the header, e.g. “Truth of God”."
        >
          {(props) => <Input {...props} {...text('shortName')} />}
        </Field>
        <Field
          id="org-tagline"
          label="Tagline"
          optional
          error={errors.tagline}
          className="sm:col-span-2"
        >
          {(props) => <Input {...props} {...text('tagline')} />}
        </Field>
        <Field
          id="org-description"
          label="About the church"
          optional
          error={errors.description}
          className="sm:col-span-2"
        >
          {(props) => <Textarea {...props} {...text('description')} rows={3} />}
        </Field>
        <Field
          id="org-email"
          label="Contact e-mail"
          optional
          error={errors.email}
          description="Also used for privacy requests."
        >
          {(props) => <Input {...props} {...text('email')} type="email" />}
        </Field>
        <Field id="org-phone" label="Contact phone" optional error={errors.phone}>
          {(props) => <Input {...props} {...text('phone')} type="tel" />}
        </Field>
        <Field id="org-website" label="Other website" optional error={errors.websiteUrl}>
          {(props) => (
            <Input {...props} {...text('websiteUrl')} type="url" placeholder="https://" />
          )}
        </Field>
        <Field id="org-timezone" label="Time zone" error={errors.timezone}>
          {(props) => <Input {...props} {...text('timezone')} />}
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-base font-semibold">On the site</legend>
        <div className="flex items-start gap-2">
          <Checkbox
            id="org-registration"
            checked={values.registrationOpen}
            onChange={(e) => setValues((v) => ({ ...v, registrationOpen: e.target.checked }))}
          />
          <label htmlFor="org-registration" className="text-sm">
            Anyone can create an account
          </label>
        </div>
        <div className="flex items-start gap-2">
          <Checkbox
            id="org-baptism"
            checked={values.baptismRequestsEnabled}
            onChange={(e) => setValues((v) => ({ ...v, baptismRequestsEnabled: e.target.checked }))}
          />
          <label htmlFor="org-baptism" className="text-sm">
            Accept baptism enquiries through the website
          </label>
        </div>
      </fieldset>

      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-3 text-base font-semibold">Social media</legend>
        {(['facebook', 'youtube', 'instagram', 'x'] as const).map((key) => (
          <Field
            key={key}
            id={`org-social-${key}`}
            label={key === 'x' ? 'X (Twitter)' : key[0]!.toUpperCase() + key.slice(1)}
            optional
            error={errors[`socialLinks.${key}`]}
          >
            {(props) => <Input {...props} {...social(key)} type="url" placeholder="https://" />}
          </Field>
        ))}
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-base font-semibold">Notifications for new members</legend>
        <p className="mb-3 text-sm text-muted">
          What new accounts receive until they choose for themselves.
        </p>
        <table className="w-full max-w-lg text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs tracking-wide text-subtle uppercase">
              <th scope="col" className="py-2 font-medium">
                Updates about
              </th>
              <th scope="col" className="w-20 py-2 text-center font-medium">
                In the app
              </th>
              <th scope="col" className="w-20 py-2 text-center font-medium">
                E-mail
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {NotificationCategory.values.map((c) => (
              <tr key={c}>
                <th scope="row" className="py-2 text-left font-normal">
                  {NOTIFICATION_CATEGORY_LABEL[c]}
                </th>
                <td className="py-2 text-center">
                  <Checkbox
                    className="mt-0"
                    checked={values.defaultInAppCategories.includes(c)}
                    onChange={() => toggleCategory('defaultInAppCategories', c)}
                    aria-label={`${NOTIFICATION_CATEGORY_LABEL[c]}: in the app`}
                  />
                </td>
                <td className="py-2 text-center">
                  <Checkbox
                    className="mt-0"
                    checked={values.defaultEmailCategories.includes(c)}
                    onChange={() => toggleCategory('defaultEmailCategories', c)}
                    aria-label={`${NOTIFICATION_CATEGORY_LABEL[c]}: e-mail`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </fieldset>

      <SubmitButton loading={busy} className="self-start">
        Save settings
      </SubmitButton>
    </form>
  );
}
