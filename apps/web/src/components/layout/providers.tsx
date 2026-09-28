'use client';

import { Toaster } from '@church/ui/toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { NowPlaying } from '@/components/player/now-playing';
import { PlayerProvider } from '@/components/player/player-context';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      {/* The player wraps everything, so its one <audio> element survives navigation and a
          sermon keeps playing while somebody reads the news. */}
      <PlayerProvider>
        <Toaster>{children}</Toaster>
        <NowPlaying />
      </PlayerProvider>
    </QueryClientProvider>
  );
}
