import { IsoDate } from '@church/shared';
import { Button } from '@church/ui/button';
import { EmptyState } from '@church/ui/empty-state';
import { Input, NativeSelect } from '@church/ui/input';
import { ScrollText } from 'lucide-react';
import type { Metadata } from 'next';
import { AdminPageHeader } from '@/components/admin/admin-page';
import { Pagination } from '@/components/admin/pagination';
import { pageParam, requireArea } from '@/lib/admin';
import { unwrap, userApi } from '@/lib/api/server';
import { param } from '@/lib/context';
import { formatDate, formatTime } from '@/lib/format';

export const metadata: Metadata = { title: 'Audit log' };

const AREAS = [
  { value: 'content.', label: 'Content' },
  { value: 'membership.', label: 'Memberships' },
  { value: 'baptism_request.', label: 'Baptism enquiries' },
  { value: 'role.', label: 'Roles' },
  { value: 'user.', label: 'Accounts' },
  { value: 'branch.', label: 'Branches' },
  { value: 'settings.', label: 'Settings' },
  { value: 'auth.', label: 'Sign-in security' },
  { value: 'profile.', label: 'Profiles' },
];

function show(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export default async function AuditPage({ searchParams }: PageProps<'/admin/audit'>) {
  await requireArea('audit');
  const params = await searchParams;
  const action = AREAS.find((a) => a.value === param(params, 'action'))?.value;
  const from = IsoDate.safeParse(param(params, 'from')).data;
  const to = IsoDate.safeParse(param(params, 'to')).data;
  const page = pageParam(param(params, 'page'));
  const client = await userApi();
  const log = unwrap(
    await client.GET('/api/v1/admin/audit', {
      params: { query: { action, from, to, page, pageSize: 50 } },
    }),
  );

  return (
    <>
      <AdminPageHeader
        title="Audit log"
        description="Who changed what, and when. Entries cannot be edited."
      />
      <form
        method="get"
        action="/admin/audit"
        className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-end"
      >
        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor="audit-area" className="font-medium">
            Area
          </label>
          <NativeSelect id="audit-area" name="action" defaultValue={action ?? ''}>
            <option value="">Everything</option>
            {AREAS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor="audit-from" className="font-medium">
            From
          </label>
          <Input id="audit-from" type="date" name="from" defaultValue={from} />
        </div>
        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor="audit-to" className="font-medium">
            To
          </label>
          <Input id="audit-to" type="date" name="to" defaultValue={to} />
        </div>
        <Button type="submit" variant="secondary">
          Show
        </Button>
      </form>
      {log.items.length === 0 ? (
        <EmptyState
          icon={<ScrollText />}
          title="No entries"
          description="Nothing was recorded for these filters."
        />
      ) : (
        <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-card">
          {log.items.map((e) => {
            const changes = e.changes ? Object.entries(e.changes) : [];
            return (
              <li key={e.id} className="flex flex-col gap-1 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span>
                    <code className="rounded bg-surface-muted px-1.5 py-0.5 text-xs">
                      {e.action}
                    </code>{' '}
                    <span className="font-medium">{e.actor?.name ?? 'System'}</span>
                    {e.summary ? <span className="text-muted"> · {e.summary}</span> : null}
                  </span>
                  <time dateTime={e.createdAt} className="text-xs text-muted tabular-nums">
                    {formatDate(e.createdAt)} {formatTime(e.createdAt)}
                  </time>
                </div>
                <span className="text-xs text-subtle">
                  {e.entityType}
                  {e.branch ? ` · ${e.branch.name}` : ''}
                  {e.ipAddress ? ` · ${e.ipAddress}` : ''}
                </span>
                {changes.length > 0 ? (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted">
                      {changes.length} {changes.length === 1 ? 'change' : 'changes'}
                    </summary>
                    <dl className="mt-2 grid gap-1 sm:grid-cols-[10rem_minmax(0,1fr)]">
                      {changes.map(([field, change]) => (
                        <div key={field} className="contents">
                          <dt className="font-medium">{field}</dt>
                          <dd className="break-words text-muted">
                            {show(change.from)} → {show(change.to)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
      <Pagination
        path="/admin/audit"
        query={{ action, from, to }}
        page={log.page}
        pageSize={log.pageSize}
        total={log.total}
      />
    </>
  );
}
