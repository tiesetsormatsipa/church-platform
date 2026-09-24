import { CONTENT_TYPE_LABEL, ContentStatus, ContentType, Slug } from '@church/shared';
import { Button, buttonVariants } from '@church/ui/button';
import { EmptyState } from '@church/ui/empty-state';
import { Input, NativeSelect } from '@church/ui/input';
import { segmentClass, SegmentedNav } from '@church/ui/segmented';
import { FileText, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminPageHeader } from '@/components/admin/admin-page';
import { Pagination } from '@/components/admin/pagination';
import { ContentStatusBadge } from '@/components/admin/status-badges';
import { TypeLabel } from '@/components/content/badges';
import { pageParam, requireArea } from '@/lib/admin';
import { unwrap, userApi } from '@/lib/api/server';
import { href, param } from '@/lib/context';
import { formatDate, formatEventTiming } from '@/lib/format';

export const metadata: Metadata = { title: 'Content' };

const STATUS_TABS: { value: ContentStatus | undefined; label: string }[] = [
  { value: undefined, label: 'All' },
  { value: 'DRAFT', label: 'Drafts' },
  { value: 'PENDING_REVIEW', label: 'In review' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
];

export default async function AdminContentPage({ searchParams }: PageProps<'/admin/content'>) {
  await requireArea('content');
  const params = await searchParams;
  const status = ContentStatus.schema.safeParse(param(params, 'status')).data;
  const type = ContentType.schema.safeParse(param(params, 'type')).data;
  const branchValue = param(params, 'branch');
  const branch = branchValue === 'global' ? 'global' : Slug.safeParse(branchValue).data;
  const q = param(params, 'q')?.trim().slice(0, 100) || undefined;
  const mine = param(params, 'mine') === 'true' ? ('true' as const) : undefined;
  const page = pageParam(param(params, 'page'));

  const client = await userApi();
  const [list, options] = await Promise.all([
    client
      .GET('/api/v1/admin/content', {
        params: { query: { status, type, branch, q, mine, page, pageSize: 25 } },
      })
      .then(unwrap),
    client.GET('/api/v1/admin/content/options').then(unwrap),
  ]);
  const keep = { type, branch, q, mine };
  const now = new Date().getTime();

  return (
    <>
      <AdminPageHeader
        title="Content"
        description="Announcements, news, events, sermons and baptism stories."
        actions={
          <Link
            href={`/admin/content/new?type=${type ?? 'ANNOUNCEMENT'}`}
            className={buttonVariants({ variant: 'primary' })}
          >
            <Plus aria-hidden="true" /> New{' '}
            {type ? CONTENT_TYPE_LABEL[type].singular.toLowerCase() : 'item'}
          </Link>
        }
      />
      <div className="flex flex-col gap-3">
        <div className="relative -mx-4 scrollbar-none overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <SegmentedNav label="Filter by status">
            {STATUS_TABS.map((tab) => (
              <li key={tab.label}>
                <Link
                  href={href('/admin/content', { ...keep, status: tab.value })}
                  aria-current={status === tab.value ? 'page' : undefined}
                  className={segmentClass(status === tab.value)}
                >
                  {tab.label}
                </Link>
              </li>
            ))}
          </SegmentedNav>
        </div>
        <form
          method="get"
          action="/admin/content"
          className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
        >
          {status ? <input type="hidden" name="status" value={status} /> : null}
          {mine ? <input type="hidden" name="mine" value="true" /> : null}
          <Input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search titles"
            aria-label="Search titles"
          />
          <NativeSelect name="type" defaultValue={type ?? ''} aria-label="Kind">
            <option value="">All kinds</option>
            {ContentType.values.map((t) => (
              <option key={t} value={t}>
                {CONTENT_TYPE_LABEL[t].plural}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect name="branch" defaultValue={branch ?? ''} aria-label="Where">
            <option value="">Everywhere</option>
            {options.canCreateGlobal ? <option value="global">Church-wide</option> : null}
            {options.branches.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.name}
              </option>
            ))}
          </NativeSelect>
          <Button type="submit" variant="secondary">
            Filter
          </Button>
        </form>
      </div>

      {list.items.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title="Nothing here yet"
          description={
            status || type || q
              ? 'No content matches these filters.'
              : 'Create the first announcement for your branch.'
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
          <table className="w-full text-sm">
            <caption className="sr-only">Content items</caption>
            <thead className="hidden border-b border-border bg-surface-muted text-left text-xs tracking-wide text-subtle uppercase md:table-header-group">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Title
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Where
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.items.map((item) => {
                const scheduled =
                  item.status === 'PUBLISHED' &&
                  item.publishedAt !== null &&
                  new Date(item.publishedAt).getTime() > now;
                return (
                  <tr key={item.id} className="flex flex-col gap-1 px-4 py-3 md:table-row md:p-0">
                    <td className="md:px-4 md:py-3">
                      <div className="flex flex-col gap-1">
                        <TypeLabel type={item.type} />
                        <Link
                          href={`/admin/content/${item.id}`}
                          className="font-semibold text-foreground hover:underline"
                        >
                          {item.title}
                        </Link>
                        {item.eventStartsAt ? (
                          <span className="text-xs text-muted">
                            {formatEventTiming({
                              startsAt: item.eventStartsAt,
                              endsAt: null,
                              allDay: false,
                            })}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="text-muted md:px-4 md:py-3">
                      {item.branch?.name ?? 'Church-wide'}
                    </td>
                    <td className="md:px-4 md:py-3">
                      <ContentStatusBadge status={item.status} scheduled={scheduled} />
                      {scheduled && item.publishedAt ? (
                        <span className="ml-2 text-xs text-muted">
                          {formatDate(item.publishedAt)}
                        </span>
                      ) : null}
                    </td>
                    <td className="text-xs text-muted md:px-4 md:py-3 md:text-sm">
                      {formatDate(item.updatedAt)}
                      {item.createdBy ? (
                        <span className="block text-xs text-subtle">by {item.createdBy}</span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        path="/admin/content"
        query={{ ...keep, status }}
        page={list.page}
        pageSize={list.pageSize}
        total={list.total}
      />
    </>
  );
}
