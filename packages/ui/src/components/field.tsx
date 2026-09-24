import * as React from 'react';
import { cn } from '../lib/cn';

export function Label({ className, ...props }: React.ComponentProps<'label'>) {
  // eslint-disable-next-line jsx-a11y/label-has-associated-control -- callers pass htmlFor
  return <label className={cn('text-sm font-medium text-foreground', className)} {...props} />;
}

interface FieldProps {
  /** id of the control; used for the label and to link description/error text. */
  id: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  /** Render the control with the accessibility props already applied. */
  children: (props: {
    id: string;
    'aria-invalid'?: true;
    'aria-describedby'?: string;
  }) => React.ReactNode;
}

/** Label + control + help text + error, wired together for screen readers. */
export function Field({
  id,
  label,
  description,
  error,
  optional,
  className,
  children,
}: FieldProps) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {optional ? <span className="ml-1 font-normal text-subtle">(optional)</span> : null}
      </Label>
      {children({
        id,
        ...(error ? { 'aria-invalid': true as const } : {}),
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
      })}
      {description ? (
        <p id={descriptionId} className="text-xs text-muted">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
