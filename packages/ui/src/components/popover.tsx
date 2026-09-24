'use client';

import { Popover as BasePopover } from '@base-ui/react/popover';
import * as React from 'react';
import { cn } from '../lib/cn';

export const Popover = BasePopover.Root;
export const PopoverTrigger = BasePopover.Trigger;
export const PopoverClose = BasePopover.Close;

export function PopoverContent({
  className,
  align = 'center',
  sideOffset = 8,
  title,
  children,
}: {
  className?: string;
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  /** Accessible title, visually hidden. */
  title: string;
  children: React.ReactNode;
}) {
  return (
    <BasePopover.Portal>
      <BasePopover.Positioner className="z-50" align={align} sideOffset={sideOffset}>
        <BasePopover.Popup
          className={cn(
            'max-h-(--available-height) w-80 origin-(--transform-origin) overflow-y-auto rounded-xl border border-border bg-surface p-2 text-sm text-foreground shadow-overlay outline-none',
            'transition-[transform,opacity] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0',
            className,
          )}
        >
          <BasePopover.Title className="sr-only">{title}</BasePopover.Title>
          {children}
        </BasePopover.Popup>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  );
}
