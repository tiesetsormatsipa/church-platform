import type { Metadata } from 'next';
import { AdminPageHeader, Panel } from '@/components/admin/admin-page';
import { SettingsForm } from '@/components/admin/settings-form';
import { requireArea } from '@/lib/admin';
import { unwrap, userApi } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  await requireArea('settings');
  const client = await userApi();
  const settings = unwrap(await client.GET('/api/v1/admin/settings'));
  return (
    <>
      <AdminPageHeader
        title="Settings"
        description="Applies to the whole church. Changes appear on the site within a minute."
      />
      <Panel>
        <SettingsForm settings={settings} />
      </Panel>
    </>
  );
}
