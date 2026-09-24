import { buttonVariants } from '@church/ui/button';
import { Container } from '@church/ui/container';
import { EmptyState } from '@church/ui/empty-state';
import { Compass } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <Container className="py-16">
      <EmptyState
        headingLevel={1}
        icon={<Compass />}
        title="We couldn’t find that page"
        description="It may have moved, or the link may be out of date. Try the home page or search."
        action={
          <>
            <Link href="/" className={buttonVariants({ variant: 'primary' })}>
              Go to the home page
            </Link>
            <Link href="/search" className={buttonVariants({ variant: 'secondary' })}>
              Search
            </Link>
          </>
        }
      />
    </Container>
  );
}
