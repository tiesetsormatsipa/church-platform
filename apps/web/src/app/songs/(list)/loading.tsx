import { Container } from '@church/ui/container';
import { Skeleton } from '@church/ui/skeleton';

export default function LoadingSongs() {
  return (
    <Container className="py-8">
      <Skeleton className="h-8 w-48" />
      <div className="mt-6 flex flex-col gap-2">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </Container>
  );
}
