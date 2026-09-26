'use client';

import * as React from 'react';
import { api } from '@/lib/api/client';

/**
 * Opening a thread means you have read it.
 *
 * Reading is a write, so it happens from the browser once the page is on screen. The page is
 * deliberately not refreshed afterwards: the unread badge is server-rendered and catches up
 * on the next navigation, which is quieter than reloading the thread you are reading.
 */
export function MarkRead({ conversationId, unread }: { conversationId: string; unread: number }) {
  React.useEffect(() => {
    if (unread === 0) return;
    void api.POST('/api/v1/me/messages/{id}/read', { params: { path: { id: conversationId } } });
  }, [conversationId, unread]);

  return null;
}
