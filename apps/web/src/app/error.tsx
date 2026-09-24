'use client';

import { Button, buttonVariants } from '@church/ui/button';
import { Container } from '@church/ui/container';
import { EmptyState } from '@church/ui/empty-state';
import { CloudOff } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  return (
    <Container className="py-16">
      <EmptyState
        headingLevel={1}
        icon={<CloudOff />}
        title={offline ? 'You appear to be offline' : 'Something went wrong'}
        description={
          offline
            ? 'Check your internet connection and try again.'
            : 'We could not load this page. Please try again in a moment.'
        }
        action={
          <>
            <Button onClick={reset}>Try again</Button>
            <Link href="/" className={buttonVariants({ variant: 'secondary' })}>
              Home
            </Link>
          </>
        }
      />
      {error.digest ? <p className="mt-4 text-center text-xs text-subtle">Reference: {error.digest}</p> : null}
    </Container>
  );
}
