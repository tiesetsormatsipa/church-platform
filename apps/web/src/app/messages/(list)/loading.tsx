import { Container } from '@church/ui/container';
import { Skeleton } from '@church/ui/skeleton';

export default function LoadingMessages() {
  return (
    <Container className="py-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </Container>
  );
}
