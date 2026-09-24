import type {
  BaptismRequestStatus,
  ContentStatus,
  MembershipStatus,
  UserStatus,
} from '@church/shared';
import { Badge } from '@church/ui/badge';

type Tone =
  'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'outline';

const CONTENT: Record<ContentStatus, [string, Tone]> = {
  DRAFT: ['Draft', 'neutral'],
  PENDING_REVIEW: ['In review', 'warning'],
  PUBLISHED: ['Published', 'success'],
  ARCHIVED: ['Archived', 'outline'],
};

const MEMBERSHIP: Record<MembershipStatus, [string, Tone]> = {
  PENDING: ['Waiting', 'warning'],
  ACTIVE: ['Member', 'success'],
  REJECTED: ['Declined', 'danger'],
  LEFT: ['Left', 'neutral'],
};

const BAPTISM: Record<BaptismRequestStatus, [string, Tone]> = {
  NEW: ['New', 'warning'],
  CONTACTED: ['Contacted', 'info'],
  SCHEDULED: ['Scheduled', 'primary'],
  COMPLETED: ['Baptised', 'success'],
  CLOSED: ['Closed', 'neutral'],
};

const USER: Record<UserStatus, [string, Tone]> = {
  ACTIVE: ['Active', 'success'],
  SUSPENDED: ['Suspended', 'danger'],
  DEACTIVATED: ['Deactivated', 'neutral'],
};

export const BAPTISM_STATUS_LABEL = Object.fromEntries(
  Object.entries(BAPTISM).map(([k, [l]]) => [k, l]),
) as Record<BaptismRequestStatus, string>;

export function ContentStatusBadge({
  status,
  scheduled,
}: {
  status: ContentStatus;
  scheduled?: boolean;
}) {
  if (status === 'PUBLISHED' && scheduled) return <Badge tone="info">Scheduled</Badge>;
  const [label, tone] = CONTENT[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function MembershipStatusBadge({ status }: { status: MembershipStatus }) {
  const [label, tone] = MEMBERSHIP[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function BaptismStatusBadge({ status }: { status: BaptismRequestStatus }) {
  const [label, tone] = BAPTISM[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function UserStatusBadge({ status }: { status: UserStatus }) {
  const [label, tone] = USER[status];
  return <Badge tone={tone}>{label}</Badge>;
}
