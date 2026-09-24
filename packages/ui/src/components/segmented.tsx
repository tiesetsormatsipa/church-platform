import * as React from 'react';
import { cn } from '../lib/cn';

/**
 * A row of mutually exclusive options rendered as links (navigation) — keeps state in the
 * URL so views are shareable. Use `aria-current` on the active item.
 */
export function SegmentedNav({
  className,
  label,
  children,
}: {
  className?: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <nav
      aria-label={label}
      className={cn('inline-flex rounded-lg border border-border bg-surface-muted p-1', className)}
    >
      <ul className="flex gap-1">{children}</ul>
    </nav>
  );
}

export const segmentClass = (active: boolean) =>
  cn(
    'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors [&_svg]:size-4',
    active ? 'bg-surface text-foreground shadow-card' : 'text-muted hover:text-foreground',
  );

/** Horizontally scrollable chips (e.g. branch or type filters). */
export const chipClass = (active: boolean) =>
  cn(
    'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors [&_svg]:size-4',
    active
      ? 'border-primary bg-primary text-primary-foreground'
      : 'border-border-strong bg-surface text-foreground hover:bg-surface-muted',
  );
