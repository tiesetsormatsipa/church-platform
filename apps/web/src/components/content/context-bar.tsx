import type { ScopeFilter } from '@church/shared';
import { segmentClass, SegmentedNav } from '@church/ui/segmented';
import { Globe, MapPin } from 'lucide-react';
import Link from 'next/link';
import { href } from '@/lib/context';

interface ContextBarProps {
  path: string;
  branch: { slug: string; name: string } | null;
  scope: ScopeFilter;
  /** Other query parameters to keep when changing the scope. */
  keep?: Record<string, string | undefined>;
}

/**
 * States what the visitor is looking at ("Global" or a branch plus church-wide content) and
 * lets them narrow it. Everything is a link, so the view is part of the URL.
 */
export function ContextBar({ path, branch, scope, keep = {} }: ContextBarProps) {
  const link = (next: ScopeFilter) =>
    href(path, { ...keep, branch: branch?.slug, scope: next === 'all' ? undefined : next });
  const options: { value: ScopeFilter; label: string }[] = branch
    ? [
        { value: 'all', label: `${branch.name} + church-wide` },
        { value: 'branch', label: `${branch.name} only` },
        { value: 'global', label: 'Church-wide only' },
      ]
    : [
        { value: 'all', label: 'Everything' },
        { value: 'global', label: 'Church-wide' },
        { value: 'branch', label: 'From branches' },
      ];
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-center gap-2 text-sm text-muted">
        {branch ? (
          <MapPin aria-hidden="true" className="size-4 text-accent-strong" />
        ) : (
          <Globe aria-hidden="true" className="size-4 text-link" />
        )}
        {branch ? (
          <span>
            Showing <strong className="font-semibold text-foreground">{branch.name}</strong> and
            church-wide news.
          </span>
        ) : (
          <span>
            Showing <strong className="font-semibold text-foreground">the whole church</strong>:
            every branch.
          </span>
        )}
      </p>
      <div className="-mx-4 scrollbar-none overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <SegmentedNav label="Filter by where content comes from">
          {options.map((o) => (
            <li key={o.value}>
              <Link
                href={link(o.value)}
                aria-current={scope === o.value ? 'page' : undefined}
                className={segmentClass(scope === o.value)}
              >
                {o.label}
              </Link>
            </li>
          ))}
        </SegmentedNav>
      </div>
    </div>
  );
}
