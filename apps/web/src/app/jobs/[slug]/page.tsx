import { CacheTags, EMPLOYMENT_TYPE_LABEL } from '@church/shared';
import { Alert } from '@church/ui/alert';
import { Badge } from '@church/ui/badge';
import { buttonVariants } from '@church/ui/button';
import { Container } from '@church/ui/container';
import { ArrowLeft, Briefcase, Mail, MapPin } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Markdown } from '@/components/content/markdown';
import { PageHeader } from '@/components/content/page-header';
import { publicApi, unwrap } from '@/lib/api/server';
import { formatDate } from '@/lib/format';

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function load(slug: string) {
  const { client, fetch } = await publicApi({
    tags: [CacheTags.content, CacheTags.contentItem(slug)],
    revalidate: 120,
  });
  return unwrap(await client.GET('/api/v1/jobs/{slug}', { fetch, params: { path: { slug } } }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const job = await load((await params).slug);
  return {
    title: job.title,
    description: job.summary ?? `${job.job.employerName}, ${job.job.location}`,
    alternates: { canonical: `/jobs/${job.slug}` },
  };
}

export default async function JobPage({ params }: PageProps) {
  const job = await load((await params).slug);

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/jobs" className="inline-flex items-center gap-1 text-link">
            <ArrowLeft aria-hidden="true" className="size-4" />
            All jobs
          </Link>
        }
        title={job.title}
        description={job.summary ?? undefined}
      />
      <Container className="py-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          {job.job.closed ? (
            <Alert tone="warning" title="This opening has closed">
              It closed on {formatDate(job.job.closesOn!)}. It is kept here so older links still
              lead somewhere.
            </Alert>
          ) : null}

          <dl className="grid gap-4 rounded-xl border border-border bg-surface p-5 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted">Employer</dt>
              <dd className="font-medium">{job.job.employerName}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Where</dt>
              <dd className="flex items-center gap-1 font-medium">
                <MapPin aria-hidden="true" className="size-4" />
                {job.job.location}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Kind of work</dt>
              <dd className="font-medium">
                <Badge>
                  <Briefcase aria-hidden="true" className="size-3.5" />
                  {EMPLOYMENT_TYPE_LABEL[job.job.employmentType]}
                </Badge>
              </dd>
            </div>
            {job.job.salaryRange ? (
              <div>
                <dt className="text-sm text-muted">Pay</dt>
                <dd className="font-medium">{job.job.salaryRange}</dd>
              </div>
            ) : null}
            {job.job.closesOn ? (
              <div>
                <dt className="text-sm text-muted">Closes</dt>
                <dd className="font-medium">{formatDate(job.job.closesOn)}</dd>
              </div>
            ) : null}
            {job.postedBy ? (
              <div>
                <dt className="text-sm text-muted">Posted by</dt>
                <dd className="font-medium">{job.postedBy}</dd>
              </div>
            ) : null}
          </dl>

          {job.body ? <Markdown>{job.body}</Markdown> : null}

          {job.job.closed ? null : (
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
              <h2 className="text-lg font-semibold">How to apply</h2>
              {job.job.applyNote ? <p className="text-sm">{job.job.applyNote}</p> : null}
              {job.job.applyEmail ? (
                <a
                  href={`mailto:${job.job.applyEmail}`}
                  className={buttonVariants({ variant: 'primary', className: 'self-start' })}
                >
                  <Mail aria-hidden="true" />
                  Write to {job.job.applyEmail}
                </a>
              ) : null}
              {job.job.applyUrl ? (
                <a
                  href={job.job.applyUrl}
                  rel="nofollow noopener noreferrer"
                  target="_blank"
                  className={buttonVariants({ variant: 'primary', className: 'self-start' })}
                >
                  Apply on the employer&rsquo;s site
                </a>
              ) : null}
            </div>
          )}
        </div>
      </Container>
    </>
  );
}
