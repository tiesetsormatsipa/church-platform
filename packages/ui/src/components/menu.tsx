'use client';

import { Menu as BaseMenu } from '@base-ui/react/menu';
import * as React from 'react';
import { cn } from '../lib/cn';

export const Menu = BaseMenu.Root;
export const MenuTrigger = BaseMenu.Trigger;

export function MenuContent({
  className,
  align = 'end',
  sideOffset = 8,
  children,
}: {
  className?: string;
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  children: React.ReactNode;
}) {
  return (
    <BaseMenu.Portal>
      <BaseMenu.Positioner className="z-50 outline-none" align={align} sideOffset={sideOffset}>
        <BaseMenu.Popup
          className={cn(
            'min-w-52 origin-(--transform-origin) rounded-xl border border-border bg-surface p-1.5 text-sm text-foreground shadow-overlay outline-none',
            'transition-[transform,opacity] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0',
            className,
          )}
        >
          {children}
        </BaseMenu.Popup>
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  );
}

const itemClass =
  'flex w-full cursor-default items-center gap-2.5 rounded-lg px-2.5 py-2 text-left outline-none select-none data-highlighted:bg-surface-muted [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted';

export function MenuItem({ className, ...props }: React.ComponentProps<typeof BaseMenu.Item>) {
  return <BaseMenu.Item className={cn(itemClass, className)} {...props} />;
}

export function MenuLinkItem({
  className,
  ...props
}: React.ComponentProps<typeof BaseMenu.LinkItem>) {
  return <BaseMenu.LinkItem closeOnClick className={cn(itemClass, className)} {...props} />;
}

export function MenuSeparator({ className }: { className?: string }) {
  return <BaseMenu.Separator className={cn('my-1.5 h-px bg-border', className)} />;
}

export function MenuLabel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('px-2.5 pt-1.5 pb-1 text-xs font-medium text-subtle', className)}>
      {children}
    </div>
  );
}
