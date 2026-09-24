import { Container } from '@church/ui/container';
import { Skeleton } from '@church/ui/skeleton';

/**
 * Placeholder while a listing page loads. Only listing pages use loading.tsx: a Suspense
 * boundary starts streaming with status 200, so pages that can 404 or redirect (detail
 * pages) must not sit inside one (see node_modules/next/dist/docs, loading.md "Status Codes").
 */
export function PageSkeleton({ variant = 'list' }: { variant?: 'list' | 'grid' }) {
  return (
    <div aria-busy="true">
      <span className="sr-only" role="status">
        Loading
      </span>
      <div className="border-b border-border bg-surface">
        <Container className="flex flex-col gap-3 py-8 sm:py-10">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-2/3 max-w-md" />
          <Skeleton className="h-5 w-full max-w-xl" />
          <Skeleton className="mt-2 h-9 w-full max-w-lg rounded-full" />
        </Container>
      </div>
      <Container className="py-8">
        {variant === 'grid' ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        )}
      </Container>
    </div>
  );
}
