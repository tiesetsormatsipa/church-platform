import { BaptismRequestStatus } from '@church/shared';
import { EmptyState } from '@church/ui/empty-state';
import { segmentClass, SegmentedNav } from '@church/ui/segmented';
import { Droplets } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminPageHeader } from '@/components/admin/admin-page';
import { BaptismRequestCard } from '@/components/admin/baptism-request-card';
import { Pagination } from '@/components/admin/pagination';
import { BAPTISM_STATUS_LABEL } from '@/components/admin/status-badges';
import { pageParam, requireArea } from '@/lib/admin';
import { unwrap, userApi } from '@/lib/api/server';
import { href, param } from '@/lib/context';

export const metadata: Metadata = { title: 'Baptism enquiries' };

export default async function AdminBaptismPage({ searchParams }: PageProps<'/admin/baptism'>) {
  await requireArea('baptism');
  const params = await searchParams;
  const statusParam = param(params, 'status');
  const status =
    statusParam === 'all'
      ? undefined
      : (BaptismRequestStatus.schema.safeParse(statusParam).data ?? 'NEW');
  const page = pageParam(param(params, 'page'));
  const client = await userApi();
  const list = unwrap(
    await client.GET('/api/v1/admin/baptism-requests', {
      params: { query: { status, page, pageSize: 20 } },
    }),
  );
  const tabs = [
    ...BaptismRequestStatus.values.map((s) => ({
      value: s as string,
      label: BAPTISM_STATUS_LABEL[s],
    })),
    { value: 'all', label: 'All' },
  ];
  const current = status ?? 'all';

  return (
    <>
      <AdminPageHeader
        title="Baptism enquiries"
        description="People who asked about being baptised. Contact them within a few days."
      />
      <div className="relative -mx-4 scrollbar-none overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <SegmentedNav label="Filter by stage">
          {tabs.map((tab) => (
            <li key={tab.value}>
              <Link
                href={href('/admin/baptism', {
                  status: tab.value === 'NEW' ? undefined : tab.value,
                })}
                aria-current={current === tab.value ? 'page' : undefined}
                className={segmentClass(current === tab.value)}
              >
                {tab.label}
              </Link>
            </li>
          ))}
        </SegmentedNav>
      </div>
      {list.items.length === 0 ? (
        <EmptyState
          icon={<Droplets />}
          title={status === 'NEW' ? 'No new enquiries' : 'Nothing here'}
          description={
            status === 'NEW' ? 'New enquiries from the baptism page will appear here.' : undefined
          }
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {list.items.map((r) => (
            <li key={r.id}>
              <BaptismRequestCard request={r} />
            </li>
          ))}
        </ul>
      )}
      <Pagination
        path="/admin/baptism"
        query={{ status: current === 'NEW' ? undefined : current }}
        page={list.page}
        pageSize={list.pageSize}
        total={list.total}
      />
    </>
  );
}
