'use client';

import { Toast } from '@base-ui/react/toast';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import * as React from 'react';
import { cn } from '../lib/cn';

/** Global manager so non-React code (API helpers) can raise toasts. */
export const toastManager = Toast.createToastManager();

export type ToastTone = 'success' | 'error' | 'info';

export function toast(options: { title: string; description?: string; tone?: ToastTone; timeout?: number }) {
  toastManager.add({
    title: options.title,
    description: options.description,
    type: options.tone ?? 'info',
    ...(options.timeout !== undefined ? { timeout: options.timeout } : {}),
  });
}

const ICONS = { success: CheckCircle2, error: XCircle, info: Info } as const;

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((item) => {
    const tone = (item.type as ToastTone | undefined) ?? 'info';
    const Icon = ICONS[tone];
    return (
      <Toast.Root
        key={item.id}
        toast={item}
        className={cn(
          'absolute right-0 bottom-0 z-[calc(1000-var(--toast-index))] w-full rounded-xl border border-border bg-surface text-foreground shadow-overlay select-none',
          '[transform:translateY(calc(var(--toast-index)*-0.75rem))_scale(calc(1-var(--toast-index)*0.05))] data-expanded:[transform:translateY(calc(var(--toast-offset-y)*-1-var(--toast-index)*0.75rem))]',
          'transition-all duration-300 ease-out-soft data-ending-style:opacity-0 data-limited:opacity-0 data-starting-style:[transform:translateY(150%)]',
        )}
      >
        <Toast.Content className="flex items-start gap-3 p-4">
          <Icon
            aria-hidden="true"
            className={cn('mt-0.5 size-5 shrink-0', {
              'text-success': tone === 'success',
              'text-danger': tone === 'error',
              'text-info': tone === 'info',
            })}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <Toast.Title className="text-sm font-semibold" />
            <Toast.Description className="text-sm text-muted" />
          </div>
          <Toast.Close
            aria-label="Dismiss"
            className="-m-1 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-muted"
          >
            <X className="size-4" aria-hidden="true" />
          </Toast.Close>
        </Toast.Content>
      </Toast.Root>
    );
  });
}

export function Toaster({ children }: { children?: React.ReactNode }) {
  return (
    <Toast.Provider toastManager={toastManager} limit={3} timeout={5000}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] z-[60] w-[calc(100vw-2rem)] sm:right-6 sm:bottom-6 sm:w-96">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}
