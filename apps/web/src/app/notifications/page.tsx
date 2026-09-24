import { Container } from '@church/ui/container';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/content/page-header';
import { NotificationList } from '@/components/account/notification-list';
import { unwrap, userApi } from '@/lib/api/server';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Notifications',
  robots: { index: false },
};

export default async function NotificationsPage() {
  await requireUser('/notifications');
  const client = await userApi();
  const page = await client
    .GET('/api/v1/me/notifications', { params: { query: { limit: 20 } } })
    .then(unwrap);

  return (
    <>
      <PageHeader
        eyebrow="Your account"
        title="Notifications"
        description="What has happened since you were last here."
      />
      <Container className="py-8">
        <div className="mx-auto max-w-2xl">
          <NotificationList
            initial={page.items}
            initialCursor={page.nextCursor}
            initialUnread={page.unread}
          />
        </div>
      </Container>
    </>
  );
}
