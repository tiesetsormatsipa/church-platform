'use client';

import { Drawer } from '@base-ui/react/drawer';
import { X } from 'lucide-react';
import * as React from 'react';
import { cn } from '../lib/cn';

type Side = 'bottom' | 'right' | 'left';

const SWIPE: Record<Side, 'down' | 'right' | 'left'> = {
  bottom: 'down',
  right: 'right',
  left: 'left',
};

export function Sheet({
  side = 'bottom',
  ...props
}: React.ComponentProps<typeof Drawer.Root> & { side?: Side }) {
  return <Drawer.Root swipeDirection={SWIPE[side]} {...props} />;
}

export const SheetTrigger = Drawer.Trigger;
export const SheetClose = Drawer.Close;

interface SheetContentProps {
  side?: Side;
  title: React.ReactNode;
  description?: React.ReactNode;
  hideTitle?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Bottom sheet on phones, side panel on larger screens. Swipe to dismiss is supported;
 * Escape and the close button always work.
 */
export function SheetContent({
  side = 'bottom',
  title,
  description,
  hideTitle,
  className,
  children,
}: SheetContentProps) {
  const position = {
    bottom: 'items-end justify-center',
    right: 'items-stretch justify-end',
    left: 'items-stretch justify-start',
  }[side];
  const panel = {
    bottom:
      'w-full max-h-[85dvh] rounded-t-2xl border-t pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] [transform:translateY(var(--drawer-swipe-movement-y))] data-starting-style:[transform:translateY(100%)] data-ending-style:[transform:translateY(100%)]',
    right:
      'h-full w-[min(22rem,calc(100vw-3rem))] border-l [transform:translateX(var(--drawer-swipe-movement-x))] data-starting-style:[transform:translateX(100%)] data-ending-style:[transform:translateX(100%)]',
    left: 'h-full w-[min(22rem,calc(100vw-3rem))] border-r [transform:translateX(var(--drawer-swipe-movement-x))] data-starting-style:[transform:translateX(-100%)] data-ending-style:[transform:translateX(-100%)]',
  }[side];
  return (
    <Drawer.Portal>
      <Drawer.Backdrop className="fixed inset-0 z-50 bg-black/40 opacity-[calc(1-var(--drawer-swipe-progress,0))] transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0" />
      <Drawer.Viewport className={cn('fixed inset-0 z-50 flex', position)}>
        <Drawer.Popup
          className={cn(
            'relative flex flex-col overflow-y-auto overscroll-contain border-border bg-surface px-5 pt-3 text-foreground shadow-overlay outline-none',
            'transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:duration-0 data-swiping:select-none',
            panel,
            className,
          )}
        >
          {side === 'bottom' ? (
            <div
              aria-hidden="true"
              className="mx-auto mb-3 h-1.5 w-10 shrink-0 rounded-full bg-border-strong"
            />
          ) : null}
          <Drawer.Content className="flex flex-col">
            <div
              className={cn(
                'mb-4 flex items-start justify-between gap-4',
                side !== 'bottom' && 'pt-3',
                hideTitle && 'sr-only',
              )}
            >
              <div className="flex flex-col gap-1">
                <Drawer.Title className="text-lg font-semibold">{title}</Drawer.Title>
                {description ? (
                  <Drawer.Description className="text-sm text-muted">
                    {description}
                  </Drawer.Description>
                ) : null}
              </div>
              <Drawer.Close
                aria-label="Close"
                className="-mr-2 inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground"
              >
                <X className="size-5" aria-hidden="true" />
              </Drawer.Close>
            </div>
            {children}
          </Drawer.Content>
        </Drawer.Popup>
      </Drawer.Viewport>
    </Drawer.Portal>
  );
}
