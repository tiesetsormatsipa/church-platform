import { buttonVariants } from '@church/ui/button';
import { Card } from '@church/ui/card';
import {
  CalendarDays,
  ClipboardList,
  Droplets,
  FilePen,
  FileText,
  Headphones,
  Megaphone,
  Plus,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminPageHeader } from '@/components/admin/admin-page';
import { getAdminSummary } from '@/lib/admin';
import { getSessionUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Overview' };

function Stat({
  href,
  label,
  value,
  hint,
  icon,
}: {
  href: string;
  label: string;
  value: number;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="relative flex items-start gap-4 p-5 transition-shadow hover:shadow-raised">
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground [&_svg]:size-5"
      >
        {icon}
      </span>
      <div className="flex flex-col">
        <Link
          href={href}
          className="text-sm font-medium text-muted after:absolute after:inset-0 hover:text-foreground"
        >
          {label}
        </Link>
        <span className="font-serif text-3xl font-semibold tabular-nums">{value}</span>
        <span className="text-xs text-subtle">{hint}</span>
      </div>
    </Card>
  );
}

export default async function AdminOverviewPage() {
  const [summary, user] = await Promise.all([getAdminSummary(), getSessionUser()]);
  const { areas, counts } = summary;
  return (
    <>
      <AdminPageHeader
        title={`Welcome, ${user?.firstName ?? 'friend'}`}
        description="What needs your attention today."
        actions={
          areas.content ? (
            <Link
              href="/admin/content/new?type=ANNOUNCEMENT"
              className={buttonVariants({ variant: 'primary' })}
            >
              <Plus aria-hidden="true" /> New announcement
            </Link>
          ) : undefined
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {areas.content ? (
          <>
            <Stat
              href="/admin/content?status=PENDING_REVIEW"
              label="Waiting for review"
              value={counts.contentAwaitingReview}
              hint="Submitted by editors"
              icon={<FileText />}
            />
            <Stat
              href="/admin/content?status=DRAFT&mine=true"
              label="Your drafts"
              value={counts.myDrafts}
              hint="Not published yet"
              icon={<FilePen />}
            />
            <Stat
              href="/admin/content?type=EVENT&status=PUBLISHED"
              label="Upcoming events"
              value={counts.upcomingEvents}
              hint="Published and still to come"
              icon={<CalendarDays />}
            />
          </>
        ) : null}
        {areas.memberships ? (
          <Stat
            href="/admin/memberships"
            label="Membership requests"
            value={counts.pendingMemberships}
            hint="People asking to join"
            icon={<ClipboardList />}
          />
        ) : null}
      </div>
      {areas.content ? (
        <section aria-labelledby="create-heading" className="flex flex-col gap-3">
          <h2 id="create-heading" className="text-lg font-semibold">
            Share something
          </h2>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/content/new?type=ANNOUNCEMENT"
              className={buttonVariants({ variant: 'secondary' })}
            >
              <Megaphone aria-hidden="true" /> Announcement
            </Link>
            <Link
              href="/admin/content/new?type=EVENT"
              className={buttonVariants({ variant: 'secondary' })}
            >
              <CalendarDays aria-hidden="true" /> Event
            </Link>
            <Link
              href="/admin/content/new?type=NEWS"
              className={buttonVariants({ variant: 'secondary' })}
            >
              <FileText aria-hidden="true" /> News story
            </Link>
            <Link
              href="/admin/content/new?type=SERMON"
              className={buttonVariants({ variant: 'secondary' })}
            >
              <Headphones aria-hidden="true" /> Sermon
            </Link>
            <Link
              href="/admin/content/new?type=BAPTISM"
              className={buttonVariants({ variant: 'secondary' })}
            >
              <Droplets aria-hidden="true" /> Baptism story
            </Link>
          </div>
        </section>
      ) : null}
    </>
  );
}
