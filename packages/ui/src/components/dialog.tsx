'use client';

import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import * as React from 'react';
import { cn } from '../lib/cn';

export const Dialog = BaseDialog.Root;
export const DialogTrigger = BaseDialog.Trigger;
export const DialogClose = BaseDialog.Close;

interface DialogContentProps extends Omit<React.ComponentProps<typeof BaseDialog.Popup>, 'title'> {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Hide the visual title (it remains available to screen readers). */
  hideTitle?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' } as const;

export function DialogContent({
  className,
  title,
  description,
  hideTitle,
  size = 'md',
  children,
  ...props
}: DialogContentProps) {
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
      <BaseDialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
        <BaseDialog.Popup
          className={cn(
            'relative flex max-h-[90dvh] w-full flex-col overflow-y-auto overscroll-contain rounded-t-2xl border border-border bg-surface p-6 text-foreground shadow-overlay outline-none *:shrink-0 sm:rounded-2xl',
            'transition-all duration-200 ease-out-soft data-ending-style:translate-y-4 data-ending-style:opacity-0 data-starting-style:translate-y-4 data-starting-style:opacity-0',
            SIZES[size],
            className,
          )}
          {...props}
        >
          <div className={cn('mb-4 flex items-start gap-4 pr-8', hideTitle && 'sr-only')}>
            <div className="flex flex-col gap-1">
              <BaseDialog.Title className="text-xl font-semibold">{title}</BaseDialog.Title>
              {description ? (
                <BaseDialog.Description className="text-sm text-muted">
                  {description}
                </BaseDialog.Description>
              ) : null}
            </div>
          </div>
          {children}
          <BaseDialog.Close
            aria-label="Close"
            className="absolute top-4 right-4 inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground"
          >
            <X className="size-5" aria-hidden="true" />
          </BaseDialog.Close>
        </BaseDialog.Popup>
      </BaseDialog.Viewport>
    </BaseDialog.Portal>
  );
}
