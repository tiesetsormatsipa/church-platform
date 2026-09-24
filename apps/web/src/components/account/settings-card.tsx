import { cn } from '@church/ui/lib/cn';

/** A titled section of the account settings. */
export function SettingsCard({
  id,
  title,
  description,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn('rounded-xl border border-border bg-surface shadow-card', className)}>
      <div className="flex flex-col gap-1 border-b border-border px-5 py-4 sm:px-6">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}
