import * as React from 'react';
import { cn } from '../lib/cn';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  /** Compact variant for side panels. */
  size?: 'md' | 'sm';
}

/** Friendly placeholder when there is nothing to show yet. */
export function EmptyState({ icon, title, description, action, className, size = 'md' }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-xl border border-dashed border-border-strong bg-surface text-center',
        size === 'md' ? 'gap-3 px-6 py-12' : 'gap-2 px-4 py-6',
        className,
      )}
    >
      {icon ? (
        <div
          aria-hidden="true"
          className={cn(
            'flex items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground',
            size === 'md' ? 'size-12 [&_svg]:size-6' : 'size-9 [&_svg]:size-4',
          )}
        >
          {icon}
        </div>
      ) : null}
      <p className={cn('font-serif font-semibold text-foreground', size === 'md' ? 'text-xl' : 'text-base')}>{title}</p>
      {description ? <p className="max-w-md text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}
