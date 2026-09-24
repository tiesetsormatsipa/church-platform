import * as React from 'react';
import { cn } from '../lib/cn';

export const fieldControlClass = cn(
  'w-full rounded-lg border border-border-strong bg-surface px-3 text-base text-foreground shadow-card sm:text-sm',
  'placeholder:text-subtle',
  'transition-colors focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring',
  'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70',
  'aria-invalid:border-danger aria-invalid:focus-visible:outline-danger',
);

export function Input({ className, type = 'text', ...props }: React.ComponentProps<'input'>) {
  return <input type={type} className={cn(fieldControlClass, 'h-11 sm:h-10', className)} {...props} />;
}

export function Textarea({ className, rows = 4, ...props }: React.ComponentProps<'textarea'>) {
  return <textarea rows={rows} className={cn(fieldControlClass, 'min-h-24 py-2 leading-relaxed', className)} {...props} />;
}

/** Native select: fully accessible and mobile-friendly by default. */
export function NativeSelect({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select className={cn(fieldControlClass, 'h-11 appearance-none pr-9 sm:h-10', className)} {...props}>
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted"
      >
        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function Checkbox({ className, ...props }: Omit<React.ComponentProps<'input'>, 'type'>) {
  return (
    <input
      type="checkbox"
      className={cn(
        'mt-0.5 size-4 shrink-0 rounded border-border-strong accent-primary',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        className,
      )}
      {...props}
    />
  );
}
