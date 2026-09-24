import { Uuid } from '@church/shared';
import { Alert } from '@church/ui/alert';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AccountStatus } from '@/components/admin/account-status';
import { AdminPageHeader, Panel } from '@/components/admin/admin-page';
import { RoleManager } from '@/components/admin/role-manager';
import { MembershipStatusBadge, UserStatusBadge } from '@/components/admin/status-badges';
import { requireArea } from '@/lib/admin';
import { unwrap, userApi } from '@/lib/api/server';
import { getBranches } from '@/lib/data';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Person' };

export default async function AdminPersonPage({ params }: PageProps<'/admin/people/[id]'>) {
  await requireArea('people');
  const id = Uuid.safeParse((await params).id).data;
  if (!id) notFound();
  const client = await userApi();
  const [person, roles, branches] = await Promise.all([
    client.GET('/api/v1/admin/users/{id}', { params: { path: { id } } }).then(unwrap),
    client.GET('/api/v1/admin/roles').then(unwrap),
    getBranches(),
  ]);

  return (
    <>
      <AdminPageHeader
        back={
          <Link
            href="/admin/people"
            className="inline-flex items-center gap-1 self-start text-sm font-medium text-link hover:underline"
          >
            <ArrowLeft aria-hidden="true" className="size-4" /> People
          </Link>
        }
        title={person.name}
        description={person.email}
        actions={person.canManageStatus ? <AccountStatus person={person} /> : undefined}
      />
      {person.status !== 'ACTIVE' ? (
        <Alert tone="warning" title="This account is suspended">
          {person.statusReason ?? 'No reason was recorded.'}
        </Alert>
      ) : null}
      <Panel title="Details">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Status</dt>
            <dd className="mt-1">
              <UserStatusBadge status={person.status} />
              {!person.emailVerified ? (
                <span className="ml-2 text-muted">E-mail not confirmed</span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Phone</dt>
            <dd className="mt-1">{person.phone ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted">Usually attends</dt>
            <dd className="mt-1">{person.homeBranch?.name ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted">Joined · last signed in</dt>
            <dd className="mt-1">
              {formatDate(person.createdAt)} ·{' '}
              {person.lastLoginAt ? formatDate(person.lastLoginAt) : 'never'}
            </dd>
          </div>
        </dl>
      </Panel>
      <Panel title="Branch membership">
        {person.memberships.length === 0 ? (
          <p className="text-sm text-muted">Not a member of any branch.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {person.memberships.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{m.branch.name}</span>
                <MembershipStatusBadge status={m.status} />
                <span className="text-muted">since {formatDate(m.requestedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel
        title="Roles"
        description="Roles decide what someone can do in the administration area."
      >
        <RoleManager
          person={person}
          roles={roles.items}
          branches={branches.map((b) => ({ id: b.id, slug: b.slug, name: b.name }))}
        />
      </Panel>
    </>
  );
}
