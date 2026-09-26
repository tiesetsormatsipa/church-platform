'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api/client';

/**
 * How many notifications, or messages, the signed-in visitor has not read.
 *
 * Refetched on navigation, which covers the common case of reading them and coming back.
 * Nothing is fetched while signed out, and the count reads 0 then.
 */
function useUnreadCount(
  enabled: boolean,
  path: '/api/v1/me/notifications/unread' | '/api/v1/me/messages/unread',
): number {
  const [unread, setUnread] = React.useState(0);
  const pathname = usePathname();

  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void api.GET(path).then(({ data }) => {
      if (!cancelled && data) setUnread(data.unread);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, path, pathname]);

  // Signing out must clear the badge without waiting for a fetch that will not happen.
  return enabled ? unread : 0;
}

export function useUnreadNotifications(enabled: boolean): number {
  return useUnreadCount(enabled, '/api/v1/me/notifications/unread');
}

export function useUnreadMessages(enabled: boolean): number {
  return useUnreadCount(enabled, '/api/v1/me/messages/unread');
}
