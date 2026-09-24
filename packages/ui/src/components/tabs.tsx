'use client';

import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import * as React from 'react';
import { cn } from '../lib/cn';

export const Tabs = BaseTabs.Root;

export function TabsList({ className, children, ...props }: React.ComponentProps<typeof BaseTabs.List>) {
  return (
    <BaseTabs.List
      className={cn('relative flex gap-1 overflow-x-auto border-b border-border scrollbar-none', className)}
      {...props}
    >
      {children}
      <BaseTabs.Indicator className="absolute bottom-0 left-0 h-0.5 w-(--active-tab-width) translate-x-(--active-tab-left) bg-primary transition-all duration-200 ease-out-soft" />
    </BaseTabs.List>
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof BaseTabs.Tab>) {
  return (
    <BaseTabs.Tab
      className={cn(
        'inline-flex h-11 shrink-0 items-center gap-2 px-3 text-sm font-medium whitespace-nowrap text-muted outline-none select-none hover:text-foreground data-selected:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring [&_svg]:size-4',
        className,
      )}
      {...props}
    />
  );
}

export function TabsPanel({ className, ...props }: React.ComponentProps<typeof BaseTabs.Panel>) {
  return <BaseTabs.Panel className={cn('pt-6 outline-none', className)} {...props} />;
}
