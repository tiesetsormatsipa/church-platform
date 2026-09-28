'use client';

import type { ContentSummary } from '@church/shared';
import { cn } from '@church/ui/lib/cn';
import { Pause, Play } from 'lucide-react';
import { usePlayer, type Track } from '@/components/player/player-context';

/** A sermon or a song as the player needs it. Null when there is nothing to play. */
export function toTrack(item: ContentSummary): Track | null {
  if (item.song) {
    return {
      id: item.id,
      title: item.title,
      artist: item.song.artist,
      album: item.song.album,
      durationSeconds: item.song.durationSeconds,
      audioUrl: item.song.audioUrl,
      path: item.path,
      kind: 'Song',
    };
  }
  if (item.sermon) {
    return {
      id: item.id,
      title: item.title,
      // The preacher is the artist as far as the player is concerned: it is the line under
      // the title, and it is what somebody scanning a queue reads.
      artist: item.sermon.speakerName,
      album: item.sermon.seriesTitle,
      durationSeconds: item.sermon.durationSeconds,
      audioUrl: item.sermon.audioUrl,
      path: item.path,
      kind: 'Sermon',
    };
  }
  return null;
}

/**
 * The round play button, on a sermon card or a song row.
 *
 * Pressing it queues everything shown beside it and starts at this one, which is what people
 * expect from a list in a music app: you press one thing and the rest follows.
 */
export function PlayButton({
  item,
  queue,
  size = 'md',
  className,
}: {
  item: ContentSummary;
  /** Everything on screen, so the rest plays after this one. Defaults to this item alone. */
  queue?: ContentSummary[];
  size?: 'sm' | 'md';
  className?: string;
}) {
  const player = usePlayer();
  const track = toTrack(item);
  if (!track?.audioUrl) return null;

  const isCurrent = player.current?.id === item.id;
  const isPlaying = isCurrent && player.playing;

  return (
    <button
      type="button"
      // Above the card's own full-area link, which would otherwise swallow the press.
      className={cn(
        'relative z-10 flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-card transition-transform hover:scale-105',
        size === 'sm' ? 'size-9 [&_svg]:size-4' : 'size-11 [&_svg]:size-5',
        className,
      )}
      aria-label={isPlaying ? `Pause ${item.title}` : `Play ${item.title}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (isCurrent) {
          player.toggle();
          return;
        }
        const tracks = (queue ?? [item]).map(toTrack).filter((t): t is Track => t !== null);
        const at = Math.max(
          0,
          tracks.findIndex((t) => t.id === item.id),
        );
        player.play(tracks, at);
      }}
    >
      {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" className="ms-0.5" />}
    </button>
  );
}
