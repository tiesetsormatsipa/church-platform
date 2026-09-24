import { Container } from '@church/ui/container';
import { Skeleton } from '@church/ui/skeleton';

export default function Loading() {
  return (
    <Container className="flex flex-col gap-6 py-10" aria-busy="true">
      <span className="sr-only" role="status">
        Loading
      </span>
      <Skeleton className="h-10 w-2/3 max-w-md" />
      <Skeleton className="h-5 w-full max-w-xl" />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
    </Container>
  );
}
