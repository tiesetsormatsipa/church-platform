import type { ImageDto } from '@church/shared';
import { cn } from '@church/ui/lib/cn';

interface PictureProps {
  image: ImageDto;
  /** `sizes` attribute describing the rendered width, e.g. "(min-width: 768px) 50vw, 100vw". */
  sizes: string;
  className?: string;
  alt?: string;
  priority?: boolean;
}

/**
 * Responsive image using the renditions produced by the media worker (ADR: media pipeline).
 * The dominant colour fills the box while the image loads.
 */
export function Picture({ image, sizes, className, alt, priority }: PictureProps) {
  const srcSet = image.sources
    .filter((s) => s.width)
    .map((s) => `${s.url} ${s.width}w`)
    .join(', ');
  return (
    // eslint-disable-next-line @next/next/no-img-element -- renditions come from our media pipeline
    <img
      src={image.sources.at(-1)?.url ?? image.url}
      srcSet={srcSet || undefined}
      sizes={srcSet ? sizes : undefined}
      width={image.width ?? undefined}
      height={image.height ?? undefined}
      alt={alt ?? image.alt ?? ''}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : undefined}
      className={cn('object-cover', className)}
      style={image.placeholderColor ? { backgroundColor: image.placeholderColor } : undefined}
    />
  );
}
