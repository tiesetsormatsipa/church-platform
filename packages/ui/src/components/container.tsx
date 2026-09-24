import * as React from 'react';
import { cn } from '../lib/cn';

/** Page-width container with the standard responsive gutters (16/24/32 px). */
export function Container({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('mx-auto w-full max-w-page px-4 sm:px-6 lg:px-8', className)} {...props} />
  );
}

/** Comfortable measure for long-form reading. */
export function ReadingContainer({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('mx-auto w-full max-w-reading px-4 sm:px-6', className)} {...props} />;
}
