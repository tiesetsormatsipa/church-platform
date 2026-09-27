import { Container } from '@church/ui/container';
import { Skeleton } from '@church/ui/skeleton';

export default function LoadingJobs() {
  return (
    <Container className="py-8">
      <Skeleton className="h-10 w-full" />
      <div className="mt-6 flex flex-col gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    </Container>
  );
}
