import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

export function SectionHeading({
  id,
  children,
  icon,
  action,
}: {
  id: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-border pb-2">
      <h2 id={id} className="flex items-center gap-2 text-xl font-semibold sm:text-2xl [&_svg]:size-5 [&_svg]:text-accent-strong">
        {icon ? <span aria-hidden="true">{icon}</span> : null}
        {children}
      </h2>
      {action ? (
        <Link href={action.href} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-link hover:underline">
          {action.label}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      ) : null}
    </div>
  );
}
