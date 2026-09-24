'use client';

import { Button } from '@church/ui/button';

/** "Show more" control with an announced error state. */
export function LoadMoreButton({
  hasMore,
  status,
  onLoad,
  loadedAny,
}: {
  hasMore: boolean;
  status: 'idle' | 'loading' | 'error';
  onLoad: () => void;
  loadedAny: boolean;
}) {
  if (!hasMore) {
    return loadedAny ? <p className="pt-2 text-center text-sm text-subtle">You have reached the end.</p> : null;
  }
  return (
    <div className="flex flex-col items-center gap-2 pt-2">
      {status === 'error' ? (
        <p role="alert" className="text-sm text-danger">
          Could not load more. Check your connection and try again.
        </p>
      ) : null}
      <Button variant="secondary" onClick={onLoad} loading={status === 'loading'}>
        {status === 'error' ? 'Try again' : 'Show more'}
      </Button>
    </div>
  );
}
