'use client';

import { MailCheck } from 'lucide-react';
import { useEffect, useRef } from 'react';

/** Confirmation panel after a request that sends an e-mail. Focus moves here for screen readers. */
export function CheckEmail({ title, children }: { title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
        <MailCheck aria-hidden="true" className="size-6" />
      </span>
      <h1 ref={ref} tabIndex={-1} className="text-2xl font-semibold focus:outline-none">
        {title}
      </h1>
      <div className="flex flex-col gap-2 text-sm text-muted">{children}</div>
    </div>
  );
}
