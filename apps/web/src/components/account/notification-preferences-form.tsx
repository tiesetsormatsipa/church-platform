'use client';

import { MANDATORY_EMAIL_CATEGORIES, NOTIFICATION_CATEGORY_LABEL, type NotificationPreferenceDto } from '@church/shared';
import { Checkbox } from '@church/ui/input';
import { toast } from '@church/ui/toast';
import { useState } from 'react';
import { api, ensureOk } from '@/lib/api/client';
import { SubmitButton } from '@/components/forms/submit-button';

const HINTS: Partial<Record<NotificationPreferenceDto['category'], string>> = {
  ANNOUNCEMENTS: 'Important notices from the church and your branch.',
  EVENTS: 'New events and changes to events you might attend.',
  MEMBERSHIP: 'Answers to your membership requests.',
  ACCOUNT: 'Sign-ins and password changes. E-mail stays on for your security.',
};

const mandatory = (category: string) => (MANDATORY_EMAIL_CATEGORIES as readonly string[]).includes(category);

export function NotificationPreferencesForm({ initial }: { initial: NotificationPreferenceDto[] }) {
  const [items, setItems] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(items) !== JSON.stringify(saved);

  function toggle(category: string, channel: 'inApp' | 'email') {
    setItems((prev) => prev.map((p) => (p.category === category ? { ...p, [channel]: !p[channel] } : p)));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = ensureOk(await api.PUT('/api/v1/me/notification-preferences', { body: { items } }));
      setItems(result.items);
      setSaved(result.items);
      toast({ title: 'Preferences saved', tone: 'success' });
    } catch {
      toast({ title: 'Could not save your preferences', description: 'Please try again.', tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form method="post" onSubmit={save} className="flex flex-col gap-5">
      <table className="w-full text-sm">
        <caption className="sr-only">How you hear about each kind of update</caption>
        <thead>
          <tr className="border-b border-border text-left text-xs tracking-wide text-subtle uppercase">
            <th scope="col" className="py-2 pr-4 font-medium">
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
          {items.map((item) => {
            const label = NOTIFICATION_CATEGORY_LABEL[item.category];
            return (
              <tr key={item.category}>
                <th scope="row" className="py-3 pr-4 text-left font-normal">
                  <span className="block font-medium text-foreground">{label}</span>
                  {HINTS[item.category] ? <span className="block text-xs text-muted">{HINTS[item.category]}</span> : null}
                </th>
                <td className="py-3 text-center">
                  <Checkbox
                    checked={item.inApp}
                    onChange={() => toggle(item.category, 'inApp')}
                    aria-label={`${label}: in the app`}
                    className="mt-0 size-5"
                  />
                </td>
                <td className="py-3 text-center">
                  <Checkbox
                    checked={item.email}
                    disabled={mandatory(item.category)}
                    onChange={() => toggle(item.category, 'email')}
                    aria-label={`${label}: e-mail${mandatory(item.category) ? ' (always on)' : ''}`}
                    className="mt-0 size-5"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <SubmitButton loading={busy} disabled={!dirty} className="self-start">
        Save preferences
      </SubmitButton>
    </form>
  );
}
