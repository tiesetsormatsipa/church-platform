import { Slug } from '@church/shared';
import { Alert } from '@church/ui/alert';
import { buttonVariants } from '@church/ui/button';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminPageHeader, Panel } from '@/components/admin/admin-page';
import { BranchForm } from '@/components/admin/branch-form';
import { BranchStatusButton } from '@/components/admin/branch-status-button';
import { LeaderEditor } from '@/components/admin/leader-editor';
import { ScheduleEditor } from '@/components/admin/schedule-editor';
import { requireArea } from '@/lib/admin';
import { unwrap, userApi } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Branch' };

export default async function AdminBranchPage({ params }: PageProps<'/admin/branches/[slug]'>) {
  await requireArea('branches');
  const slug = Slug.safeParse((await params).slug).data;
  if (!slug) notFound();
  const client = await userApi();
  const [branch, all] = await Promise.all([
    client.GET('/api/v1/admin/branches/{slug}', { params: { path: { slug } } }).then(unwrap),
    client.GET('/api/v1/admin/branches').then(unwrap),
  ]);
  const archived = branch.status === 'ARCHIVED';

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
        title={branch.name}
        description={
          branch.legacyLabel && branch.legacyLabel !== branch.name
            ? `Called “${branch.legacyLabel}” in the old system`
            : undefined
        }
        actions={
          <>
            {!archived ? (
              <Link
                href={`/branches/${branch.slug}`}
                target="_blank"
                className={buttonVariants({ variant: 'ghost' })}
              >
                <ExternalLink aria-hidden="true" /> View page
              </Link>
            ) : null}
            {branch.canArchive ? (
              <BranchStatusButton slug={branch.slug} name={branch.name} archived={archived} />
            ) : null}
          </>
        }
      />
      {archived ? (
        <Alert tone="warning" title="Archived">
          This branch is hidden from the site.
        </Alert>
      ) : null}
      <Panel
        title="Service times"
        description="Temporary changes (with dates) are shown as notices on the branch page."
      >
        <ScheduleEditor slug={branch.slug} schedules={branch.schedules} />
      </Panel>
      <Panel title="Leaders">
        <LeaderEditor slug={branch.slug} leaders={branch.leaders} />
      </Panel>
      <Panel title="Details">
        <BranchForm
          key={branch.slug}
          branch={branch}
          parents={all.items.map((b) => ({ slug: b.slug, name: b.name }))}
        />
      </Panel>
    </>
  );
}
