import { Container } from '@church/ui/container';
import { cn } from '@church/ui/lib/cn';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('border-b border-border bg-surface', className)}>
      <Container className="flex flex-col gap-4 py-8 sm:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex max-w-3xl flex-col gap-2">
            {eyebrow ? <p className="text-sm font-medium text-accent-strong">{eyebrow}</p> : null}
            <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
            {description ? <p className="text-base text-muted sm:text-lg">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </div>
        {children}
      </Container>
    </div>
  );
}
