import { cva, type VariantProps } from 'class-variance-authority';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import * as React from 'react';
import { cn } from '../lib/cn';

const alertVariants = cva('flex gap-3 rounded-lg border p-4 text-sm [&>svg]:mt-0.5 [&>svg]:size-5 [&>svg]:shrink-0', {
  variants: {
    tone: {
      info: 'border-info/25 bg-info-soft text-foreground [&>svg]:text-info',
      success: 'border-success/25 bg-success-soft text-foreground [&>svg]:text-success',
      warning: 'border-warning/30 bg-warning-soft text-foreground [&>svg]:text-warning',
      danger: 'border-danger/25 bg-danger-soft text-foreground [&>svg]:text-danger',
    },
  },
  defaultVariants: { tone: 'info' },
});

const ICONS = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle } as const;

export type AlertProps = Omit<React.ComponentProps<'div'>, 'title'> &
  VariantProps<typeof alertVariants> & { title?: React.ReactNode };

export function Alert({ className, tone = 'info', title, children, ...props }: AlertProps) {
  const Icon = ICONS[tone ?? 'info'];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn(alertVariants({ tone }), className)} {...props}>
      <Icon aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-muted [&_a]:font-medium [&_a]:text-link [&_a]:underline">{children}</div> : null}
      </div>
    </div>
  );
}
