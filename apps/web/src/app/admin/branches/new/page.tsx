import { can, ORGANIZATION_TARGET } from '@church/shared';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminPageHeader, Panel } from '@/components/admin/admin-page';
import { BranchForm } from '@/components/admin/branch-form';
import { requireArea } from '@/lib/admin';
import { unwrap, userApi } from '@/lib/api/server';
import { grantsOfUser } from '@/lib/grants';
import { getSessionUser } from '@/lib/session';

export const metadata: Metadata = { title: 'New branch' };

export default async function NewBranchPage() {
  await requireArea('branches');
  const user = await getSessionUser();
  if (!can(grantsOfUser(user), 'branch.create', ORGANIZATION_TARGET)) notFound();
  const client = await userApi();
  const all = unwrap(await client.GET('/api/v1/admin/branches'));
  return (
    <>
      <AdminPageHeader
        back={
          <Link
            href="/admin/branches"
            className="inline-flex items-center gap-1 self-start text-sm font-medium text-link hover:underline"
          >
            <ArrowLeft aria-hidden="true" className="size-4" /> Branches
          </Link>
        }
        title="New branch"
        description="Add service times and leaders after creating it."
      />
      <Panel>
        <BranchForm
          branch={null}
          parents={all.items.map((b) => ({ slug: b.slug, name: b.name }))}
        />
      </Panel>
    </>
  );
}
