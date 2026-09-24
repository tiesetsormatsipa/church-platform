import { MembershipStatus } from '@church/shared';
import { EmptyState } from '@church/ui/empty-state';
import { segmentClass, SegmentedNav } from '@church/ui/segmented';
import { ClipboardList } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminPageHeader } from '@/components/admin/admin-page';
import { MembershipActions } from '@/components/admin/membership-actions';
import { Pagination } from '@/components/admin/pagination';
import { MembershipStatusBadge } from '@/components/admin/status-badges';
import { pageParam, requireArea } from '@/lib/admin';
import { unwrap, userApi } from '@/lib/api/server';
import { href, param } from '@/lib/context';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Memberships' };

const TABS = [
  { value: 'PENDING', label: 'Waiting' },
  { value: 'ACTIVE', label: 'Members' },
  { value: 'REJECTED', label: 'Declined' },
  { value: 'LEFT', label: 'Left' },
] as const;

export default async function AdminMembershipsPage({
  searchParams,
}: PageProps<'/admin/memberships'>) {
  await requireArea('memberships');
  const params = await searchParams;
  const status = MembershipStatus.schema.safeParse(param(params, 'status')).data ?? 'PENDING';
  const page = pageParam(param(params, 'page'));
  const client = await userApi();
  const list = unwrap(
    await client.GET('/api/v1/admin/memberships', {
      params: { query: { status, page, pageSize: 25 } },
    }),
  );

  return (
    <>
      <AdminPageHeader
        title="Memberships"
        description="People asking to belong to a branch, and current members."
      />
      <div className="relative -mx-4 scrollbar-none overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <SegmentedNav label="Filter by status">
          {TABS.map((tab) => (
            <li key={tab.value}>
              <Link
                href={href('/admin/memberships', {
                  status: tab.value === 'PENDING' ? undefined : tab.value,
                })}
                aria-current={status === tab.value ? 'page' : undefined}
                className={segmentClass(status === tab.value)}
              >
                {tab.label}
              </Link>
            </li>
          ))}
        </SegmentedNav>
      </div>
      {list.items.length === 0 ? (
        <EmptyState
          icon={<ClipboardList />}
          title={status === 'PENDING' ? 'No requests waiting' : 'Nobody here'}
          description={
            status === 'PENDING'
              ? 'New requests to join your branches will appear here.'
              : undefined
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {list.items.map((m) => (
            <li
              key={m.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-card sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{m.person.name}</span>
                  <MembershipStatusBadge status={m.status} />
                </div>
                <span className="text-sm break-all text-muted">{m.person.email}</span>
                <span className="text-sm text-muted">
                  {m.branch.name} · asked {formatDate(m.requestedAt)}
                  {m.decidedAt
                    ? ` · ${m.status === 'ACTIVE' ? 'approved' : 'decided'} ${formatDate(m.decidedAt)}${m.decidedBy ? ` by ${m.decidedBy}` : ''}`
                    : ''}
                </span>
                {m.message ? (
                  <blockquote className="mt-1 border-l-2 border-border-strong pl-3 text-sm">
                    {m.message}
                  </blockquote>
                ) : null}
                {m.decisionNote ? (
                  <p className="text-sm text-muted">Note: {m.decisionNote}</p>
                ) : null}
              </div>
              <MembershipActions membership={m} />
            </li>
          ))}
        </ul>
      )}
      <Pagination
        path="/admin/memberships"
        query={{ status: status === 'PENDING' ? undefined : status }}
        page={list.page}
        pageSize={list.pageSize}
        total={list.total}
      />
    </>
  );
}
