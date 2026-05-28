'use client';

export function toast({ title, description }: { title: string; description?: string }) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('church-platform:toast', {
      detail: { title, description },
    }),
  );
}
