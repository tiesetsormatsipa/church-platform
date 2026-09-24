'use client';

import { Button } from '@church/ui/button';
import { toast } from '@church/ui/toast';
import { Share2 } from 'lucide-react';

/** Native share sheet where available, otherwise copies the link. */
export function ShareButton({ title, path }: { title: string; path: string }) {
  async function share() {
    const url = new URL(path, window.location.origin).toString();
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
      } catch {
        // Dismissed by the visitor: nothing to do.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copied', tone: 'success' });
    } catch {
      toast({ title: 'Could not copy the link', description: url, tone: 'error' });
    }
  }
  return (
    <Button variant="secondary" size="sm" onClick={share}>
      <Share2 aria-hidden="true" /> Share
    </Button>
  );
}
