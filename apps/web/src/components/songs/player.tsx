/**
 * Turning a content row into something the site-wide player understands.
 *
 * The player itself lives in `components/player`, mounted once in the root layout, so that a
 * song keeps playing when somebody leaves this page.
 */
import type { ContentSummary } from '@church/shared';
import type { Track } from '@/components/player/player-context';

export function toTrack(item: ContentSummary): Track {
  return {
    id: item.id,
    title: item.title,
    artist: item.song?.artist ?? null,
    album: item.song?.album ?? null,
    durationSeconds: item.song?.durationSeconds ?? null,
    audioUrl: item.song?.audioUrl ?? null,
    path: item.path,
    kind: 'Song',
  };
}
