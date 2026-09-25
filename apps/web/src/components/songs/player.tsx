'use client';

import type { ContentSummary } from '@church/shared';
import { Button } from '@church/ui/button';
import { cn } from '@church/ui/lib/cn';
import {
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import * as React from 'react';

export interface Track {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  durationSeconds: number | null;
  audioUrl: string | null;
  path: string;
}

export function toTrack(item: ContentSummary): Track {
  return {
    id: item.id,
    title: item.title,
    artist: item.song?.artist ?? null,
    album: item.song?.album ?? null,
    durationSeconds: item.song?.durationSeconds ?? null,
    audioUrl: item.song?.audioUrl ?? null,
    path: item.path,
  };
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '--:--';
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

interface Props {
  queue: Track[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
}

/**
 * The bar that stays at the foot of the songs page while something is playing.
 *
 * One `<audio>` element for the whole queue rather than one per row: the browser keeps a
 * single connection, and moving to the next song is a change of `src` instead of a new
 * element mounting. Everything here is a real control, so it works by keyboard.
 */
export function Player({ queue, index, onIndexChange }: Props) {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [position, setPosition] = React.useState(0);
  const [duration, setDuration] = React.useState<number | null>(null);
  const [muted, setMuted] = React.useState(false);
  const [repeat, setRepeat] = React.useState(false);
  const [shuffle, setShuffle] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  const track = index === null ? null : (queue[index] ?? null);

  // A new track means a new source; start it playing because the listener asked for it.
  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track?.audioUrl) {
      setPlaying(false);
      return;
    }
    setFailed(false);
    setPosition(0);
    audio.src = track.audioUrl;
    void audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));
  }, [track?.id, track?.audioUrl]);

  function step(direction: 1 | -1) {
    if (index === null || queue.length === 0) return;
    if (shuffle && queue.length > 1) {
      let next = index;
      while (next === index) next = Math.floor(Math.random() * queue.length);
      onIndexChange(next);
      return;
    }
    const next = index + direction;
    if (next < 0) onIndexChange(queue.length - 1);
    else if (next >= queue.length) onIndexChange(repeat ? 0 : null);
    else onIndexChange(next);
  }

  if (!track) return null;

  const total = duration ?? track.durationSeconds ?? null;

  return (
    <div
      role="region"
      aria-label="Player"
      className="sticky bottom-0 z-20 mt-8 rounded-xl border border-border bg-surface/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-surface/80"
    >
      {/*
        No <track>: these are music recordings and the church has no caption files for them.
        An empty track element would announce captions that do not exist, which is worse for
        a screen reader than none. The words are published as lyrics on the song's own page.
      */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        preload="none"
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) =>
          setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : null)
        }
        onEnded={() => step(1)}
        onError={() => {
          setFailed(true);
          setPlaying(false);
        }}
      />

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{track.title}</p>
          <p className="truncate text-xs text-muted">
            {[track.artist, track.album].filter(Boolean).join(' · ') || 'Song'}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-pressed={shuffle}
            aria-label="Shuffle"
            onClick={() => setShuffle((v) => !v)}
            className={cn(shuffle && 'text-accent-strong')}
          >
            <Shuffle aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Previous song" onClick={() => step(-1)}>
            <SkipBack aria-hidden="true" />
          </Button>
          <Button
            variant="primary"
            size="icon"
            aria-label={playing ? 'Pause' : 'Play'}
            disabled={!track.audioUrl}
            onClick={() => {
              const audio = audioRef.current;
              if (!audio) return;
              if (playing) {
                audio.pause();
                setPlaying(false);
              } else {
                void audio
                  .play()
                  .then(() => setPlaying(true))
                  .catch(() => setFailed(true));
              }
            }}
          >
            {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </Button>
          <Button variant="ghost" size="icon" aria-label="Next song" onClick={() => step(1)}>
            <SkipForward aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-pressed={repeat}
            aria-label="Repeat the list"
            onClick={() => setRepeat((v) => !v)}
            className={cn(repeat && 'text-accent-strong')}
          >
            <Repeat aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={muted ? 'Unmute' : 'Mute'}
            onClick={() => {
              const audio = audioRef.current;
              if (!audio) return;
              audio.muted = !muted;
              setMuted(!muted);
            }}
          >
            {muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
          </Button>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-3">
        <span className="w-10 shrink-0 text-end text-xs text-muted tabular-nums">
          {formatDuration(position)}
        </span>
        <input
          type="range"
          min={0}
          max={total ?? 100}
          step={1}
          value={Math.min(position, total ?? 100)}
          aria-label="Position in the song"
          disabled={!total}
          onChange={(e) => {
            const audio = audioRef.current;
            if (!audio) return;
            audio.currentTime = Number(e.target.value);
            setPosition(Number(e.target.value));
          }}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary"
        />
        <span className="w-10 shrink-0 text-xs text-muted tabular-nums">
          {formatDuration(total)}
        </span>
      </div>

      {failed || !track.audioUrl ? (
        <p role="status" className="mt-2 text-xs text-muted">
          {track.audioUrl
            ? 'That recording could not be played.'
            : 'The recording for this song has not been uploaded yet.'}
        </p>
      ) : null}
    </div>
  );
}
