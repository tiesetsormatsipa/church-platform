import { CONTENT_TYPE_LABEL, EVENT_CATEGORY_LABEL, type ContentDetail } from '@church/shared';
import { Alert } from '@church/ui/alert';
import { buttonVariants } from '@church/ui/button';
import { Card } from '@church/ui/card';
import { Container } from '@church/ui/container';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CalendarPlus,
  Clock,
  ExternalLink,
  Languages,
  MapPin,
  MonitorPlay,
  Navigation,
  Ticket,
  User,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { formatCalendarDate, formatDate, formatDuration, formatEventTiming } from '@/lib/format';
import { EventStatusBadge, PinnedBadge, ScopeBadge, TypeLabel } from './badges';
import { ContentCard } from './content-card';
import { Markdown } from './markdown';
import { Picture } from './picture';
import { SectionHeading } from './section-heading';
import { ShareButton } from './share-button';

const BACK: Record<ContentDetail['type'], { href: string; label: string }> = {
  EVENT: { href: '/events', label: 'All events' },
  NEWS: { href: '/news', label: 'All news' },
  SERMON: { href: '/sermons', label: 'Sermon library' },
  ANNOUNCEMENT: { href: '/feed', label: 'Feed' },
  POST: { href: '/feed', label: 'Feed' },
  BAPTISM: { href: '/baptism', label: 'Baptism' },
};

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span aria-hidden="true" className="mt-0.5 text-muted [&_svg]:size-5">
        {icon}
      </span>
      <div className="flex min-w-0 flex-col">
        <dt className="text-xs font-medium tracking-wide text-subtle uppercase">{label}</dt>
        <dd className="text-sm text-foreground">{children}</dd>
      </div>
    </div>
  );
}

function EventPanel({ item }: { item: ContentDetail }) {
  const e = item.eventDetail;
  if (!e) return null;
  const cancelled = e.eventStatus === 'CANCELLED';
  return (
    <Card className="flex flex-col gap-5 p-5">
      <dl className="flex flex-col gap-4">
        <InfoRow icon={<CalendarDays />} label="When">
          <span className={cancelled ? 'line-through' : undefined}>{formatEventTiming(e, e.timezone)}</span>
          {e.timezone !== 'Africa/Johannesburg' ? <span className="block text-xs text-muted">Times in {e.timezone}</span> : null}
        </InfoRow>
        {e.venueName || e.venueAddress ? (
          <InfoRow icon={<MapPin />} label="Where">
            {e.venueName ? <span className="block">{e.venueName}</span> : null}
            {e.venueAddress ? <span className="block text-muted">{e.venueAddress}</span> : null}
          </InfoRow>
        ) : null}
        {e.onlineUrl ? (
          <InfoRow icon={<MonitorPlay />} label="Online">
            <a href={e.onlineUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-link underline">
              Join online
            </a>
          </InfoRow>
        ) : null}
        <InfoRow icon={<Users />} label="Type">
          {EVENT_CATEGORY_LABEL[e.category]}
        </InfoRow>
      </dl>
      {!cancelled ? (
        <div className="flex flex-col gap-2">
          {e.registrationUrl ? (
            <a href={e.registrationUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'primary' })}>
              <Ticket aria-hidden="true" /> Register
            </a>
          ) : null}
          <a href={`${item.path}/calendar.ics`} download className={buttonVariants({ variant: 'secondary' })}>
            <CalendarPlus aria-hidden="true" /> Add to calendar
          </a>
          {e.mapsUrl ? (
            <a href={e.mapsUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'ghost' })}>
              <Navigation aria-hidden="true" /> Directions
            </a>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function SermonPlayer({ item }: { item: ContentDetail }) {
  const s = item.sermonDetail;
  if (!s) return null;
  if (s.video) {
    return (
      // Captions are not produced yet; the transcript below is the text alternative.
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video controls preload="metadata" poster={s.video.posterUrl ?? undefined} className="aspect-video w-full rounded-xl bg-black">
        <source src={s.video.url} type={s.video.mimeType} />
        <a href={s.video.url}>Download the video</a>
      </video>
    );
  }
  if (s.audio) {
    return (
      <Card className="flex flex-col gap-3 p-4">
        <p className="text-sm font-medium">Listen</p>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption -- transcript provided below when available */}
        <audio controls preload="none" className="w-full">
          <source src={s.audio.url} type={s.audio.mimeType} />
          <a href={s.audio.url}>Download the recording</a>
        </audio>
      </Card>
    );
  }
  if (s.externalVideoUrl) {
    return (
      <a href={s.externalVideoUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'primary', className: 'self-start' })}>
        <MonitorPlay aria-hidden="true" /> Watch the recording <ExternalLink aria-hidden="true" />
      </a>
    );
  }
  return null;
}

function SermonPanel({ item }: { item: ContentDetail }) {
  const s = item.sermonDetail;
  if (!s) return null;
  const duration = formatDuration(s.durationSeconds);
  return (
    <Card className="p-5">
      <dl className="flex flex-col gap-4">
        {s.speaker ? (
          <InfoRow icon={<User />} label="Speaker">
            <Link href={`/sermons?speaker=${s.speaker.slug}`} className="font-medium text-link hover:underline">
              {s.speaker.name}
            </Link>
            {s.speaker.title ? <span className="block text-muted">{s.speaker.title}</span> : null}
          </InfoRow>
        ) : null}
        <InfoRow icon={<CalendarDays />} label="Preached">
          {formatCalendarDate(s.preachedOn)}
        </InfoRow>
        {s.scripture ? (
          <InfoRow icon={<BookOpen />} label="Scripture">
            {s.scripture}
          </InfoRow>
        ) : null}
        {s.series ? (
          <InfoRow icon={<BookOpen />} label="Series">
            <Link href={`/sermons?series=${s.series.slug}`} className="font-medium text-link hover:underline">
              {s.series.title}
            </Link>
          </InfoRow>
        ) : null}
        {duration ? (
          <InfoRow icon={<Clock />} label="Length">
            {duration}
          </InfoRow>
        ) : null}
        {s.language && s.language !== 'en' ? (
          <InfoRow icon={<Languages />} label="Language">
            {new Intl.DisplayNames(['en'], { type: 'language' }).of(s.language) ?? s.language}
          </InfoRow>
        ) : null}
      </dl>
    </Card>
  );
}

function BaptismPanel({ item }: { item: ContentDetail }) {
  const b = item.baptismDetail;
  if (!b) return null;
  return (
    <Card className="flex flex-col gap-4 p-5">
      <dl className="flex flex-col gap-4">
        {b.baptismDate ? (
          <InfoRow icon={<CalendarDays />} label="Date">
            {formatCalendarDate(b.baptismDate)}
          </InfoRow>
        ) : null}
        {b.candidatesCount ? (
          <InfoRow icon={<Users />} label="Baptised">
            {b.candidatesCount} {b.candidatesCount === 1 ? 'person' : 'people'}
          </InfoRow>
        ) : null}
        {b.location ? (
          <InfoRow icon={<MapPin />} label="Where">
            {b.location}
          </InfoRow>
        ) : null}
        {b.officiantName ? (
          <InfoRow icon={<User />} label="Officiated by">
            {b.officiantName}
          </InfoRow>
        ) : null}
      </dl>
      <Link href="/baptism" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
        Ask about being baptised
      </Link>
    </Card>
  );
}

/** Full page for one content item of any type. */
export function ContentDetailView({ item }: { item: ContentDetail }) {
  const back = BACK[item.type];
  const e = item.eventDetail;
  const hasPanel = Boolean(item.eventDetail ?? item.sermonDetail ?? item.baptismDetail);
  const updated = new Date(item.updatedAt).getTime() - new Date(item.publishedAt).getTime() > 3_600_000;

  return (
    <article>
      <header className="border-b border-border bg-surface">
        <Container className="flex flex-col gap-4 py-8 sm:py-10">
          <Link href={back.href} className="inline-flex items-center gap-1 self-start text-sm font-medium text-link hover:underline">
            <ArrowLeft aria-hidden="true" className="size-4" /> {back.label}
          </Link>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <TypeLabel type={item.type} />
            <ScopeBadge scope={item.scope} branch={item.branch} />
            {item.isPinned ? <PinnedBadge /> : null}
            {e ? <EventStatusBadge status={e.eventStatus} /> : null}
          </div>
          <h1 className="max-w-4xl text-3xl font-semibold text-balance sm:text-5xl">{item.title}</h1>
          {item.summary ? <p className="max-w-3xl text-lg text-muted">{item.summary}</p> : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {item.authorName ? <span>{item.authorName} · </span> : null}
              <time dateTime={item.publishedAt}>{formatDate(item.publishedAt)}</time>
              {updated ? (
                <span>
                  {' '}
                  · Updated <time dateTime={item.updatedAt}>{formatDate(item.updatedAt)}</time>
                </span>
              ) : null}
            </p>
            <ShareButton title={item.title} path={item.path} />
          </div>
        </Container>
      </header>

      <Container className="py-8 sm:py-10">
        <div className={hasPanel ? 'grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12' : 'mx-auto max-w-3xl'}>
          <div className="flex min-w-0 flex-col gap-8">
            {e && e.eventStatus !== 'SCHEDULED' ? (
              <Alert tone={e.eventStatus === 'CANCELLED' ? 'danger' : 'warning'} title={e.eventStatus === 'CANCELLED' ? 'This event has been cancelled' : 'This event has been postponed'}>
                {e.statusNote ?? (e.eventStatus === 'CANCELLED' ? 'We are sorry for any inconvenience.' : 'A new date will be shared here.')}
              </Alert>
            ) : null}
            <SermonPlayer item={item} />
            {item.cover && !item.sermonDetail?.video ? (
              <figure className="overflow-hidden rounded-xl border border-border">
                <Picture image={item.cover} sizes="(min-width: 1024px) 720px, 100vw" className="aspect-[16/9] w-full" priority />
                {item.cover.alt ? <figcaption className="sr-only">{item.cover.alt}</figcaption> : null}
              </figure>
            ) : null}
            {item.body ? <Markdown>{item.body}</Markdown> : null}
            {item.gallery.length > 0 ? (
              <section aria-labelledby="gallery-heading" className="flex flex-col gap-4">
                <h2 id="gallery-heading" className="text-xl font-semibold">
                  Photos
                </h2>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {item.gallery.map((image) => (
                    <li key={image.id}>
                      <figure className="flex flex-col gap-1">
                        <a href={image.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg">
                          <Picture image={image} sizes="(min-width: 640px) 33vw, 50vw" className="aspect-square w-full" />
                          <span className="sr-only">Open full-size photo{image.caption ? `: ${image.caption}` : ''}</span>
                        </a>
                        {image.caption ? <figcaption className="text-xs text-muted">{image.caption}</figcaption> : null}
                      </figure>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {item.sermonDetail?.transcript ? (
              <details className="rounded-xl border border-border bg-surface p-4">
                <summary className="cursor-pointer font-medium">Transcript</summary>
                <div className="pt-4">
                  <Markdown>{item.sermonDetail.transcript}</Markdown>
                </div>
              </details>
            ) : null}
            {item.tags.length > 0 ? (
              <ul aria-label="Tags" className="flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <li key={tag.slug}>
                    <Link
                      href={item.type === 'SERMON' ? `/sermons?tag=${tag.slug}` : `/feed?tag=${tag.slug}`}
                      className="inline-flex rounded-full bg-surface-muted px-3 py-1 text-sm text-muted hover:text-foreground"
                    >
                      #{tag.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {hasPanel ? (
            <aside aria-label={`${CONTENT_TYPE_LABEL[item.type].singular} details`} className="order-first flex flex-col gap-4 lg:sticky lg:top-24 lg:order-none lg:self-start">
              <EventPanel item={item} />
              <SermonPanel item={item} />
              <BaptismPanel item={item} />
            </aside>
          ) : null}
        </div>
      </Container>

      {item.related.length > 0 ? (
        <section aria-labelledby="related-heading" className="border-t border-border bg-surface-sunken/40">
          <Container className="flex flex-col gap-4 py-10">
            <SectionHeading id="related-heading" action={{ href: back.href, label: back.label }}>
              {item.type === 'EVENT' ? 'More events' : item.type === 'SERMON' ? 'More sermons' : 'Keep reading'}
            </SectionHeading>
            <ul className="grid gap-4 md:grid-cols-2">
              {item.related.slice(0, 4).map((r) => (
                <li key={r.id}>
                  <ContentCard item={r} />
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ) : null}
    </article>
  );
}
