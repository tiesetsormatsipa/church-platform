import { UserStatus } from '@church/shared';
import { Button } from '@church/ui/button';
import { EmptyState } from '@church/ui/empty-state';
import { Input, NativeSelect } from '@church/ui/input';
import { Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminPageHeader } from '@/components/admin/admin-page';
import { Pagination } from '@/components/admin/pagination';
import { UserStatusBadge } from '@/components/admin/status-badges';
import { pageParam, requireArea } from '@/lib/admin';
import { unwrap, userApi } from '@/lib/api/server';
import { param } from '@/lib/context';
import { getBranches } from '@/lib/data';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'People and roles' };

export default async function AdminPeoplePage({ searchParams }: PageProps<'/admin/people'>) {
  await requireArea('people');
  const params = await searchParams;
  const q = param(params, 'q')?.trim().slice(0, 100) || undefined;
  const status = UserStatus.schema.safeParse(param(params, 'status')).data;
  const branches = await getBranches();
  const branch = branches.find((b) => b.slug === param(params, 'branch'))?.slug;
  const page = pageParam(param(params, 'page'));
  const client = await userApi();
  const list = unwrap(
    await client.GET('/api/v1/admin/users', {
      params: { query: { q, status, branch, page, pageSize: 25 } },
    }),
  );

  return (
    <>
      <AdminPageHeader
        title="People and roles"
        description="Accounts in your branches, and who can do what."
      />
      <form
        method="get"
        action="/admin/people"
        role="search"
        className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
      >
        <Input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Name or e-mail"
          aria-label="Search people"
        />
        <NativeSelect name="branch" defaultValue={branch ?? ''} aria-label="Branch">
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.slug} value={b.slug}>
              {b.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="status" defaultValue={status ?? ''} aria-label="Account status">
          <option value="">Any status</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </NativeSelect>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      {list.items.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="Nobody found"
          description={q ? 'Check the spelling or search for part of the name.' : undefined}
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-card">
          {list.items.map((u) => (
            <li
              key={u.id}
              className="relative flex flex-col gap-1 px-4 py-3 hover:bg-surface-muted sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="flex min-w-0 flex-col">
                <Link
                  href={`/admin/people/${u.id}`}
                  className="font-semibold after:absolute after:inset-0"
                >
                  {u.name}
                </Link>
                <span className="text-sm break-all text-muted">{u.email}</span>
                {u.roles.length > 0 ? (
                  <span className="text-xs text-subtle">{u.roles.join(' · ')}</span>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs text-muted">
                {u.homeBranch ? <span>{u.homeBranch.name}</span> : null}
                {!u.emailVerified ? <span>E-mail not confirmed</span> : null}
                {u.status !== 'ACTIVE' ? <UserStatusBadge status={u.status} /> : null}
                <span>Joined {formatDate(u.createdAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination
        path="/admin/people"
        query={{ q, status, branch }}
        page={list.page}
        pageSize={list.pageSize}
        total={list.total}
      />
    </>
  );
}
