'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api/client';

/**
 * How many notifications the signed-in visitor has not read.
 *
 * Refetched on navigation, which covers the common case of reading them and coming back.
 * Nothing is fetched while signed out, and the count reads 0 then.
 */
export function useUnreadNotifications(enabled: boolean): number {
  const [unread, setUnread] = React.useState(0);
  const pathname = usePathname();

  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void api.GET('/api/v1/me/notifications/unread').then(({ data }) => {
      if (!cancelled && data) setUnread(data.unread);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, pathname]);

  // Signing out must clear the badge without waiting for a fetch that will not happen.
  return enabled ? unread : 0;
}
