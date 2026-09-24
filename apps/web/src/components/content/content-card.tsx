import type { ContentSummary } from '@church/shared';
import { cn } from '@church/ui/lib/cn';
import { BookOpen, CalendarDays, Headphones, MapPin, Users } from 'lucide-react';
import Link from 'next/link';
import {
  formatCalendarDate,
  formatDuration,
  formatEventTiming,
  formatRelative,
} from '@/lib/format';
import { EventStatusBadge, PinnedBadge, ScopeBadge, TypeLabel } from './badges';
import { DateTile } from './date-tile';
import { Picture } from './picture';

/**
 * Feed card used for every content type. The title is the only link; a stretched
 * pseudo-element makes the whole card clickable without nesting interactive elements.
 */
export function ContentCard({
  item,
  now,
  headingLevel = 3,
}: {
  item: ContentSummary;
  now?: Date;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const cancelled = item.event?.eventStatus === 'CANCELLED';
  return (
    <article
      className={cn(
        'group relative flex gap-4 rounded-xl border border-border bg-surface p-4 shadow-card transition-shadow hover:shadow-raised sm:p-5',
        item.isPinned && 'border-accent/50',
      )}
    >
      {item.event ? (
        <DateTile iso={item.event.startsAt} timeZone={item.event.timezone} cancelled={cancelled} />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <TypeLabel type={item.type} />
          <ScopeBadge scope={item.scope} branch={item.branch} />
          {item.isPinned ? <PinnedBadge /> : null}
          {item.event ? <EventStatusBadge status={item.event.eventStatus} /> : null}
        </div>
        <Heading
          className={cn(
            'text-lg leading-snug font-semibold text-foreground sm:text-xl',
            cancelled && 'line-through decoration-1',
          )}
        >
          <Link
            href={item.path}
            className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none"
          >
            {item.title}
          </Link>
        </Heading>
        {item.summary ? (
          <p className="line-clamp-3 text-sm leading-relaxed text-muted">{item.summary}</p>
        ) : null}
        <Meta item={item} now={now} />
      </div>
      {item.cover && !item.event ? (
        <Picture
          image={item.cover}
          sizes="(min-width: 640px) 8rem, 5rem"
          className="hidden size-24 shrink-0 rounded-lg sm:block sm:size-32"
        />
      ) : null}
    </article>
  );
}

function Meta({ item, now }: { item: ContentSummary; now?: Date }) {
  const parts: React.ReactNode[] = [];
  if (item.event) {
    parts.push(
      <span key="when" className="inline-flex items-center gap-1.5">
        <CalendarDays aria-hidden="true" className="size-4" />
        {formatEventTiming(item.event, item.event.timezone)}
      </span>,
    );
    if (item.event.venueName) {
      parts.push(
        <span key="venue" className="inline-flex items-center gap-1.5">
          <MapPin aria-hidden="true" className="size-4" />
          {item.event.venueName}
        </span>,
      );
    }
  } else if (item.sermon) {
    parts.push(
      <span key="speaker" className="inline-flex items-center gap-1.5">
        <Headphones aria-hidden="true" className="size-4" />
        {[item.sermon.speakerName, formatCalendarDate(item.sermon.preachedOn)]
          .filter(Boolean)
          .join(' · ')}
      </span>,
    );
    if (item.sermon.scripture) {
      parts.push(
        <span key="scripture" className="inline-flex items-center gap-1.5">
          <BookOpen aria-hidden="true" className="size-4" />
          {item.sermon.scripture}
        </span>,
      );
    }
    const duration = formatDuration(item.sermon.durationSeconds);
    if (duration) parts.push(<span key="duration">{duration}</span>);
  } else {
    if (item.baptism?.candidatesCount) {
      parts.push(
        <span key="candidates" className="inline-flex items-center gap-1.5">
          <Users aria-hidden="true" className="size-4" />
          {item.baptism.candidatesCount} baptised
        </span>,
      );
    }
    parts.push(
      <time key="published" dateTime={item.publishedAt}>
        {formatRelative(item.publishedAt, now)}
      </time>,
    );
    if (item.authorName) parts.push(<span key="author">{item.authorName}</span>);
  }
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">{parts}</div>
  );
}
