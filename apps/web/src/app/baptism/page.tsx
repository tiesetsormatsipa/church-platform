import { CacheTags } from '@church/shared';
import { Alert } from '@church/ui/alert';
import { Card } from '@church/ui/card';
import { Container } from '@church/ui/container';
import { CalendarDays, Droplets } from 'lucide-react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { ContentCard } from '@/components/content/content-card';
import { EventList } from '@/components/content/event-list';
import { PageHeader } from '@/components/content/page-header';
import { SectionHeading } from '@/components/content/section-heading';
import { BaptismRequestForm } from '@/components/forms/baptism-request-form';
import { publicApi, unwrap } from '@/lib/api/server';
import { branchParam } from '@/lib/context';
import { getBranches, getOrganization } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Baptism',
  description:
    'Thinking about being baptised? Find out what to expect and ask your branch to get in touch.',
  alternates: { canonical: '/baptism' },
};

const STEPS = [
  {
    title: 'Let us know',
    text: 'Send the short form on this page. It goes straight to the branch you choose.',
  },
  {
    title: 'We get in touch',
    text: 'Someone from the branch contacts you to talk, answer questions and pray with you.',
  },
  { title: 'Preparation', text: 'You meet with a minister to prepare, at a pace that suits you.' },
  {
    title: 'Baptism service',
    text: 'You are baptised at a service, surrounded by your church family.',
  },
];

export default async function BaptismPage({ searchParams }: PageProps<'/baptism'>) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  const preferred = branchParam(params) ?? cookieStore.get('cp_branch')?.value;
  const [organization, branches, { client, fetch }] = await Promise.all([
    getOrganization(),
    getBranches(),
    publicApi({ tags: [CacheTags.content] }),
  ]);
  const [services, stories] = await Promise.all([
    client
      .GET('/api/v1/events', {
        params: { query: { category: 'BAPTISM', when: 'upcoming', limit: 4 } },
        fetch,
      })
      .then(unwrap),
    client
      .GET('/api/v1/content', { params: { query: { types: 'baptism', limit: 3 } }, fetch })
      .then(unwrap),
  ]);
  const defaultBranch = branches.some((b) => b.slug === preferred) ? preferred : undefined;

  return (
    <>
      <PageHeader
        eyebrow="Taking the next step"
        title="Baptism"
        description="Baptism is a public declaration of faith. If you would like to be baptised, or just want to talk about it, we would love to hear from you."
      />
      <Container className="py-8 sm:py-10">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:gap-12">
          <div className="flex min-w-0 flex-col gap-10">
            <section aria-labelledby="steps-heading" className="flex flex-col gap-4">
              <SectionHeading id="steps-heading" icon={<Droplets />}>
                What to expect
              </SectionHeading>
              <ol className="grid gap-4 sm:grid-cols-2">
                {STEPS.map((step, index) => (
                  <li
                    key={step.title}
                    className="flex gap-4 rounded-xl border border-border bg-surface p-4"
                  >
                    <span
                      aria-hidden="true"
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft font-serif text-lg font-semibold text-primary-soft-foreground"
                    >
                      {index + 1}
                    </span>
                    <div className="flex flex-col gap-1">
                      <h3 className="font-semibold">{step.title}</h3>
                      <p className="text-sm text-muted">{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section aria-labelledby="services-heading" className="flex flex-col gap-4">
              <SectionHeading
                id="services-heading"
                icon={<CalendarDays />}
                action={{ href: '/events?category=baptism', label: 'All baptism services' }}
              >
                Upcoming baptism services
              </SectionHeading>
              {services.items.length > 0 ? (
                <Card className="p-4">
                  <EventList items={services.items} />
                </Card>
              ) : (
                <p className="text-sm text-muted">
                  No baptism services are scheduled right now. Your branch will let you know the
                  next date.
                </p>
              )}
            </section>

            {stories.items.length > 0 ? (
              <section aria-labelledby="stories-heading" className="flex flex-col gap-4">
                <SectionHeading
                  id="stories-heading"
                  action={{ href: '/feed?types=baptism', label: 'More' }}
                >
                  Recent celebrations
                </SectionHeading>
                <ul className="flex flex-col gap-4">
                  {stories.items.map((item) => (
                    <li key={item.id}>
                      <ContentCard item={item} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <section aria-labelledby="request-heading" className="lg:sticky lg:top-24 lg:self-start">
            <Card className="flex flex-col gap-5 p-5 sm:p-6">
              <div className="flex flex-col gap-1">
                <h2 id="request-heading" className="text-2xl font-semibold">
                  Ask about baptism
                </h2>
                <p className="text-sm text-muted">
                  There is no obligation. We will simply get in touch.
                </p>
              </div>
              {organization.baptismRequestsEnabled && branches.length > 0 ? (
                <BaptismRequestForm
                  branches={branches.map((b) => ({ slug: b.slug, name: b.name }))}
                  defaultBranch={defaultBranch}
                />
              ) : (
                <Alert tone="info" title="Online requests are closed for now">
                  Please speak to someone at your branch after a service.{' '}
                  <a href="/branches">Find your branch</a>.
                </Alert>
              )}
            </Card>
          </section>
        </div>
      </Container>
    </>
  );
}
