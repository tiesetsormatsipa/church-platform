import type { Metadata } from 'next';
import { ChangePasswordForm } from '@/components/account/change-password-form';
import { DeviceList } from '@/components/account/device-list';
import { SettingsCard } from '@/components/account/settings-card';
import { unwrap, userApi } from '@/lib/api/server';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Password and devices' };

export default async function SecurityPage() {
  await requireUser('/profile/security');
  const client = await userApi();
  const sessions = await client.GET('/api/v1/auth/sessions').then(unwrap);
  return (
    <>
      <SettingsCard
        id="password-heading"
        title="Password"
        description="Changing it signs you out on every other device."
      >
        <ChangePasswordForm />
      </SettingsCard>
      <SettingsCard
        id="devices-heading"
        title="Signed-in devices"
        description="Sign out anything you do not recognise."
      >
        <DeviceList initial={sessions.items} />
      </SettingsCard>
    </>
  );
}
