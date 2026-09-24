import * as React from 'react';
import { cn } from '../lib/cn';

export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('rounded-xl border border-border bg-surface shadow-card', className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1 p-5 pb-3', className)} {...props} />;
}

export function CardTitle({ className, children, ...props }: React.ComponentProps<'h3'>) {
  return (
    <h3 className={cn('text-lg leading-snug font-semibold', className)} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-sm text-muted', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('p-5 pt-0', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex items-center gap-3 border-t border-border px-5 py-3', className)} {...props} />;
}
