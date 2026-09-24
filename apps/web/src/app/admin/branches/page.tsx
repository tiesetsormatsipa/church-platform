import { BRANCH_TYPE_LABEL, can, ORGANIZATION_TARGET } from '@church/shared';
import { Badge } from '@church/ui/badge';
import { buttonVariants } from '@church/ui/button';
import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminPageHeader } from '@/components/admin/admin-page';
import { requireArea } from '@/lib/admin';
import { unwrap, userApi } from '@/lib/api/server';
import { getSessionUser } from '@/lib/session';
import { grantsOfUser } from '@/lib/grants';

export const metadata: Metadata = { title: 'Branches' };

export default async function AdminBranchesPage() {
  await requireArea('branches');
  const client = await userApi();
  const [list, user] = await Promise.all([
    client.GET('/api/v1/admin/branches').then(unwrap),
    getSessionUser(),
  ]);
  const canCreate = can(grantsOfUser(user), 'branch.create', ORGANIZATION_TARGET);
  return (
    <>
      <AdminPageHeader
        title="Branches"
        description="Details, service times and leaders shown on each branch page."
        actions={
          canCreate ? (
            <Link href="/admin/branches/new" className={buttonVariants({ variant: 'primary' })}>
              <Plus aria-hidden="true" /> New branch
            </Link>
          ) : undefined
        }
      />
      <ul className="grid gap-3 sm:grid-cols-2">
        {list.items.map((b) => (
          <li
            key={b.id}
            className="relative flex flex-col gap-1 rounded-xl border border-border bg-surface p-4 shadow-card hover:shadow-raised"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/admin/branches/${b.slug}`}
                className="font-semibold after:absolute after:inset-0"
              >
                {b.name}
              </Link>
              {b.type !== 'MAIN' ? <Badge tone="neutral">{BRANCH_TYPE_LABEL[b.type]}</Badge> : null}
              {b.status !== 'ACTIVE' ? (
                <Badge tone="outline">{b.status === 'ARCHIVED' ? 'Archived' : 'Inactive'}</Badge>
              ) : null}
            </div>
            <span className="text-sm text-muted">
              {[b.city, b.province].filter(Boolean).join(', ') || 'No location yet'}
            </span>
            <span className="text-sm text-muted">
              {b.memberCount} {b.memberCount === 1 ? 'member' : 'members'}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
