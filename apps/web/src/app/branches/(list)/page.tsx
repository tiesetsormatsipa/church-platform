import { BRANCH_TYPE_LABEL } from '@church/shared';
import { Badge } from '@church/ui/badge';
import { Container } from '@church/ui/container';
import { EmptyState } from '@church/ui/empty-state';
import { ArrowRight, Church, Clock, MapPin } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/content/page-header';
import { Picture } from '@/components/content/picture';
import { ServiceTimes } from '@/components/content/service-times';
import { getBranches, getOrganization } from '@/lib/data';

export async function generateMetadata(): Promise<Metadata> {
  const organization = await getOrganization();
  return {
    title: 'Branches',
    description: `Service times, leaders and directions for every branch of ${organization.name}.`,
    alternates: { canonical: '/branches' },
  };
}

export default async function BranchesPage() {
  const branches = await getBranches();
  return (
    <>
      <PageHeader title="Branches" description="Find a branch near you: service times, leaders and directions." />
      <Container className="py-8">
        {branches.length === 0 ? (
          <EmptyState icon={<Church />} title="No branches listed yet" description="Branch details will appear here soon." />
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((branch) => (
              <li key={branch.id}>
                <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-card transition-shadow hover:shadow-raised">
                  {branch.cover ? (
                    <Picture image={branch.cover} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="aspect-[16/7] w-full" />
                  ) : (
                    <div aria-hidden="true" className="flex aspect-[16/7] w-full items-center justify-center bg-accent-soft text-accent-soft-foreground">
                      <Church className="size-8 opacity-60" />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold">
                          <Link href={`/branches/${branch.slug}`} className="after:absolute after:inset-0 group-hover:underline">
                            {branch.name}
                          </Link>
                        </h2>
                        {branch.type !== 'MAIN' ? <Badge tone="neutral">{BRANCH_TYPE_LABEL[branch.type]}</Badge> : null}
                      </div>
                      {branch.city || branch.province ? (
                        <p className="flex items-center gap-1.5 text-sm text-muted">
                          <MapPin aria-hidden="true" className="size-4" />
                          {[branch.city, branch.province].filter(Boolean).join(', ')}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted" />
                      <ServiceTimes schedules={branch.services} compact emptyText="Service times not listed yet." />
                    </div>
                    {branch.hasTemporaryChanges ? (
                      <p className="text-sm font-medium text-warning">Temporary changes to the usual times</p>
                    ) : null}
                    <span className="mt-auto inline-flex items-center gap-1 pt-1 text-sm font-medium text-link">
                      Branch details <ArrowRight aria-hidden="true" className="size-4" />
                    </span>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </>
  );
}
