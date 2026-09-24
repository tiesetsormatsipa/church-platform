import { Avatar as BaseAvatar } from '@base-ui/react/avatar';
import { cn } from '../lib/cn';

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}

const SIZES = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-16 text-xl' } as const;

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  return (
    <BaseAvatar.Root
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft font-semibold text-primary-soft-foreground select-none',
        SIZES[size],
        className,
      )}
    >
      {src ? <BaseAvatar.Image src={src} alt="" className="size-full object-cover" /> : null}
      <BaseAvatar.Fallback aria-hidden="true">{initials(name)}</BaseAvatar.Fallback>
      <span className="sr-only">{name}</span>
    </BaseAvatar.Root>
  );
}
