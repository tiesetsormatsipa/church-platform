import type { ContentSummary } from '@church/shared';
import { Headphones, Play, Video } from 'lucide-react';
import Link from 'next/link';
import { formatCalendarDate, formatDuration } from '@/lib/format';
import { ScopeBadge } from './badges';

/** Highlighted sermon with a clear "listen" affordance. */
export function SermonCard({
  item,
  headingLevel = 3,
}: {
  item: ContentSummary;
  headingLevel?: 2 | 3;
}) {
  if (!item.sermon) return null;
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const duration = formatDuration(item.sermon.durationSeconds);
  const Icon = item.sermon.hasVideo ? Video : item.sermon.hasAudio ? Play : Headphones;
  return (
    <article className="relative flex gap-4 rounded-xl border border-border bg-surface p-4 shadow-card">
      <span
        aria-hidden="true"
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--type-sermon)_14%,transparent)] text-type-sermon [&_svg]:size-5"
      >
        <Icon />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <Heading className="font-serif text-lg leading-snug font-semibold">
          <Link href={item.path} className="after:absolute after:inset-0 hover:underline">
            {item.title}
          </Link>
        </Heading>
        <p className="text-sm text-muted">
          {[item.sermon.speakerName, formatCalendarDate(item.sermon.preachedOn), duration]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {item.sermon.scripture ? (
          <p className="text-sm text-muted italic">{item.sermon.scripture}</p>
        ) : null}
        <div className="pt-1">
          <ScopeBadge scope={item.scope} branch={item.branch} />
        </div>
      </div>
    </article>
  );
}
