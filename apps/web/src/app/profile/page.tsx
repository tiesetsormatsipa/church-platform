import { unwrap, userApi } from '@/lib/api/server';
import { MembershipPanel } from '@/components/account/membership-panel';
import { ProfileForm } from '@/components/account/profile-form';
import { SettingsCard } from '@/components/account/settings-card';
import { getBranches } from '@/lib/data';
import { requireUser } from '@/lib/session';

export default async function ProfilePage() {
  await requireUser('/profile');
  const client = await userApi();
  const [profile, branches] = await Promise.all([client.GET('/api/v1/me/profile').then(unwrap), getBranches()]);
  const options = branches.map((b) => ({ slug: b.slug, name: b.name }));
  return (
    <>
      <SettingsCard id="profile-heading" title="Your details" description="How you appear to your branch and the church.">
        <ProfileForm profile={profile} branches={options} />
      </SettingsCard>
      <SettingsCard id="membership-heading" title="Branch membership" description="Members are known to their branch leaders and receive branch updates.">
        <MembershipPanel profile={profile} branches={options} />
      </SettingsCard>
    </>
  );
}
