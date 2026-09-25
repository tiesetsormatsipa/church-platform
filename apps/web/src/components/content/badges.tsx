import {
  CONTENT_TYPE_LABEL,
  type ContentScope,
  type ContentType,
  type EventStatus,
} from '@church/shared';
import { Badge } from '@church/ui/badge';
import { cn } from '@church/ui/lib/cn';
import { Globe, MapPin, Pin } from 'lucide-react';

const TYPE_COLOR: Record<ContentType, string> = {
  ANNOUNCEMENT: 'text-type-announcement',
  POST: 'text-type-post',
  NEWS: 'text-type-news',
  EVENT: 'text-type-event',
  SERMON: 'text-type-sermon',
  BAPTISM: 'text-type-baptism',
  SONG: 'text-type-sermon',
};

/** Small uppercase label naming the kind of content. */
export function TypeLabel({ type, className }: { type: ContentType; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase',
        TYPE_COLOR[type],
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {CONTENT_TYPE_LABEL[type].singular}
    </span>
  );
}

/** Makes clear whether content is church-wide or from one branch. */
export function ScopeBadge({
  scope,
  branch,
}: {
  scope: ContentScope;
  branch: { name: string } | null;
}) {
  return scope === 'GLOBAL' || !branch ? (
    <Badge tone="primary" title="Shared with every branch">
      <Globe aria-hidden="true" /> Church-wide
    </Badge>
  ) : (
    <Badge tone="accent" title={`From the ${branch.name} branch`}>
      <MapPin aria-hidden="true" /> {branch.name}
    </Badge>
  );
}

export function PinnedBadge() {
  return (
    <Badge tone="outline">
      <Pin aria-hidden="true" /> Pinned
    </Badge>
  );
}

export function EventStatusBadge({ status }: { status: EventStatus }) {
  if (status === 'CANCELLED') return <Badge tone="danger">Cancelled</Badge>;
  if (status === 'POSTPONED') return <Badge tone="warning">Postponed</Badge>;
  return null;
}
