import { buttonVariants } from '@church/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { href } from '@/lib/context';

/** Previous / next links for offset-paginated admin lists (state in the URL). */
export function Pagination({
  path,
  query,
  page,
  pageSize,
  total,
}: {
  path: string;
  query: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1)
    return (
      <p className="text-sm text-muted">
        {total} {total === 1 ? 'item' : 'items'}
      </p>
    );
  const link = (p: number) => href(path, { ...query, page: p > 1 ? p : undefined });
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-3 text-sm">
      <p className="text-muted">
        Page {page} of {pages} · {total} items
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={link(page - 1)}
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
            rel="prev"
          >
            <ChevronLeft aria-hidden="true" /> Previous
          </Link>
        ) : null}
        {page < pages ? (
          <Link
            href={link(page + 1)}
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
            rel="next"
          >
            Next <ChevronRight aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
