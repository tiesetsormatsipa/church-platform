import { CacheTags, EMPLOYMENT_TYPE_LABEL, EmploymentType } from '@church/shared';
import { Badge } from '@church/ui/badge';
import { buttonVariants } from '@church/ui/button';
import { Container } from '@church/ui/container';
import { EmptyState } from '@church/ui/empty-state';
import { Input } from '@church/ui/input';
import { Briefcase, MapPin, PenSquare } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/content/page-header';
import { publicApi, unwrap } from '@/lib/api/server';
import { formatDate } from '@/lib/format';
import { getSessionUser } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Jobs',
  description: 'Work our members are offering one another.',
  alternates: { canonical: '/jobs' },
};

interface PageProps {
  searchParams: Promise<{ q?: string; where?: string; employmentType?: string }>;
}

export default async function JobsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.q?.trim() ?? '';
  const where = params.where?.trim() ?? '';
  const employmentType = EmploymentType.schema.safeParse(params.employmentType).data;

  const { client, fetch } = await publicApi({ tags: [CacheTags.content], revalidate: 120 });
  const page = await client
    .GET('/api/v1/jobs', {
      fetch,
      params: {
        query: {
          ...(q ? { q } : {}),
          ...(where ? { where } : {}),
          ...(employmentType ? { employmentType } : {}),
        },
      },
    })
    .then(unwrap);

  const user = await getSessionUser();

  return (
    <>
      <PageHeader
        eyebrow="The church"
        title="Jobs"
        description="Work our members are offering one another. Every posting is read by the church before it appears here."
        actions={
          user ? (
            <Link href="/profile/jobs" className={buttonVariants({ variant: 'secondary' })}>
              <PenSquare aria-hidden="true" />
              Post an opening
            </Link>
          ) : null
        }
      />
      <Container className="py-8">
        <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
          <div className="min-w-44 flex-1">
            <label htmlFor="jobs-q" className="mb-1 block text-sm font-medium">
              Search
            </label>
            <Input
              id="jobs-q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="A role or an employer"
            />
          </div>
          <div className="min-w-36 flex-1">
            <label htmlFor="jobs-where" className="mb-1 block text-sm font-medium">
              Where
            </label>
            <Input
              id="jobs-where"
              name="where"
              type="search"
              defaultValue={where}
              placeholder="Town or city"
            />
          </div>
          <div className="min-w-36">
            <label htmlFor="jobs-type" className="mb-1 block text-sm font-medium">
              Kind of work
            </label>
            <select
              id="jobs-type"
              name="employmentType"
              defaultValue={employmentType ?? ''}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="">Any</option>
              {EmploymentType.values.map((value) => (
                <option key={value} value={value}>
                  {EMPLOYMENT_TYPE_LABEL[value]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-lg border border-border-strong bg-surface px-4 text-sm font-medium hover:bg-surface-muted"
          >
            Filter
          </button>
        </form>

        {page.items.length === 0 ? (
          <EmptyState
            icon={<Briefcase aria-hidden="true" />}
            title={q || where || employmentType ? 'Nothing matches that' : 'No openings just now'}
            description={
              q || where || employmentType
                ? 'Try a wider search.'
                : 'When a member posts work, it will appear here once the church has read it.'
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {page.items.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/jobs/${job.slug}`}
                  className="block rounded-xl border border-border bg-surface p-5 hover:bg-surface-muted"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-semibold">{job.title}</span>
                    <Badge>{EMPLOYMENT_TYPE_LABEL[job.job.employmentType]}</Badge>
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                    <span>{job.job.employerName}</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin aria-hidden="true" className="size-4" />
                      {job.job.location}
                    </span>
                    {job.job.salaryRange ? <span>{job.job.salaryRange}</span> : null}
                    {job.job.closesOn ? <span>Closes {formatDate(job.job.closesOn)}</span> : null}
                  </span>
                  {job.summary ? <span className="mt-2 block text-sm">{job.summary}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </>
  );
}
