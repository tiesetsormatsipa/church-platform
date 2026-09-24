import type { ContentSummary } from '@church/shared';
import { cn } from '@church/ui/lib/cn';
import { Newspaper } from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/format';
import { ScopeBadge } from './badges';
import { Picture } from './picture';

/** Image-led article card for news listings. `lead` renders the larger headline variant. */
export function NewsCard({
  item,
  lead = false,
  headingLevel = 3,
}: {
  item: ContentSummary;
  lead?: boolean;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-card',
        lead && 'md:flex-row',
      )}
    >
      <div
        className={cn(
          'aspect-[16/9] w-full shrink-0 overflow-hidden bg-surface-sunken',
          lead && 'md:aspect-auto md:w-3/5',
        )}
      >
        {item.cover ? (
          <Picture
            image={item.cover}
            sizes={
              lead
                ? '(min-width: 768px) 60vw, 100vw'
                : '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'
            }
            className="size-full transition-transform duration-300 group-hover:scale-[1.02]"
            priority={lead}
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-primary-soft text-primary-soft-foreground">
            <Newspaper aria-hidden="true" className="size-10 opacity-60" />
          </div>
        )}
      </div>
      <div className={cn('flex flex-col gap-2 p-5', lead && 'md:justify-center md:p-8')}>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <time dateTime={item.publishedAt}>{formatDate(item.publishedAt)}</time>
          <ScopeBadge scope={item.scope} branch={item.branch} />
        </div>
        <Heading
          className={cn('leading-snug font-semibold', lead ? 'text-2xl md:text-3xl' : 'text-xl')}
        >
          <Link href={item.path} className="after:absolute after:inset-0 hover:underline">
            {item.title}
          </Link>
        </Heading>
        {item.summary ? (
          <p className={cn('text-muted', lead ? 'text-base' : 'line-clamp-3 text-sm')}>
            {item.summary}
          </p>
        ) : null}
      </div>
    </article>
  );
}
