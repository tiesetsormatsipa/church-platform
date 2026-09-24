import { cn } from '@church/ui/lib/cn';

/** Simple typographic cross mark used until the church supplies a logo file. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground', className)}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 3v18M6.5 8.5h11" />
      </svg>
    </span>
  );
}
