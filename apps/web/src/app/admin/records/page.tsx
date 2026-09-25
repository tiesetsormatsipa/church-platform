import type { Metadata } from 'next';
import { AdminPageHeader } from '@/components/admin/admin-page';
import { BaptismRecords } from '@/components/admin/baptism-records';
import { requireArea } from '@/lib/admin';
import { unwrap, userApi } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Baptism records' };

interface PageProps {
  searchParams: Promise<{ branch?: string }>;
}

export default async function AdminRecordsPage({ searchParams }: PageProps) {
  await requireArea('records');
  const client = await userApi();
  const branches = await client.GET('/api/v1/admin/branches').then(unwrap);
  const options = branches.items.map((b) => ({ slug: b.slug, name: b.name }));
  const requested = (await searchParams).branch;
  const branch = options.find((b) => b.slug === requested)?.slug ?? options[0]?.slug;

  if (!branch) {
    return (
      <>
        <AdminPageHeader
          title="Baptism records"
          description="Add a branch first; baptism numbers are kept per branch."
        />
      </>
    );
  }

  const records = await client
    .GET('/api/v1/admin/baptism-records', { params: { query: { branch } } })
    .then(unwrap);
  const total = records.items.reduce((sum, r) => sum + r.count, 0);

  return (
    <>
      <AdminPageHeader
        title="Baptism records"
        description="After a service, add how many people were baptised. The totals appear on the home page and roll up through the branches."
      />
      <BaptismRecords
        branches={options}
        initialBranch={branch}
        records={records.items}
        total={total}
      />
    </>
  );
}
