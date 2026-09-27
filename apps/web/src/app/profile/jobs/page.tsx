import type { Metadata } from 'next';
import { SettingsCard } from '@/components/account/settings-card';
import { MyPostings } from '@/components/jobs/my-postings';
import { unwrap, userApi } from '@/lib/api/server';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Your job postings' };

export default async function MyJobsPage() {
  await requireUser('/profile/jobs');
  const client = await userApi();
  const page = await client.GET('/api/v1/me/jobs').then(unwrap);
  return (
    <SettingsCard
      id="jobs-heading"
      title="Job postings"
      description="Work you are offering other members. Everything you post is read by the church before it appears on the board."
    >
      <MyPostings initial={page.items} />
    </SettingsCard>
  );
}
