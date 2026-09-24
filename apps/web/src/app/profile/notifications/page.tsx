import type { Metadata } from 'next';
import { NotificationPreferencesForm } from '@/components/account/notification-preferences-form';
import { SettingsCard } from '@/components/account/settings-card';
import { unwrap, userApi } from '@/lib/api/server';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Notification settings' };

export default async function NotificationSettingsPage() {
  await requireUser('/profile/notifications');
  const client = await userApi();
  const preferences = await client.GET('/api/v1/me/notification-preferences').then(unwrap);
  return (
    <SettingsCard id="notifications-heading" title="Notifications" description="Choose how you hear about each kind of update.">
      <NotificationPreferencesForm initial={preferences.items} />
    </SettingsCard>
  );
}
