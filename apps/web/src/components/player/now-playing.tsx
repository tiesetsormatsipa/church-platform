'use client';

import { cn } from '@church/ui/lib/cn';
import {
  ChevronDown,
  Music2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { usePlayer } from './player-context';

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '--:--';
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * The bar along the foot of every page, and the full screen it becomes on a phone.
 *
 * Deliberately the shape people already know from the music apps on their phone: artwork on
 * the left, what is playing beside it, the controls in the middle, and a line you can drag
 * to move through the recording. Nothing here is Spotify's — the colours and the type are
 * the church's — but where you press is the same, which is the whole point.
 */
export function NowPlaying() {
  const player = usePlayer();
  const [expanded, setExpanded] = React.useState(false);
  const { current, playing, position, duration, problem } = player;

  // Nothing queued: the bar is not on the screen at all, so pages get their full height.
  if (!current) return null;

  const total = duration ?? current.durationSeconds ?? null;
  const progress = total && total > 0 ? Math.min(100, (position / total) * 100) : 0;

  const scrubber = (
    <div className="flex items-center gap-2">
      <span className="w-10 shrink-0 text-right text-xs text-muted tabular-nums">
        {formatDuration(position)}
      </span>
      <input
        type="range"
        min={0}
        max={total ?? 0}
        step={1}
        value={Math.min(position, total ?? 0)}
        disabled={!total}
        onChange={(e) => player.seek(Number(e.target.value))}
        aria-label="Position in the recording"
        className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-border-strong accent-primary disabled:cursor-not-allowed"
        style={{
          background: `linear-gradient(to right, var(--color-primary) ${progress}%, var(--color-border-strong) ${progress}%)`,
        }}
      />
      <span className="w-10 shrink-0 text-xs text-muted tabular-nums">{formatDuration(total)}</span>
    </div>
  );

  const transport = (size: 'sm' | 'lg') => (
    <div className="flex items-center justify-center gap-1">
      <IconButton
        label={player.shuffle ? 'Stop shuffling' : 'Shuffle'}
        onClick={player.toggleShuffle}
        active={player.shuffle}
      >
        <Shuffle aria-hidden="true" />
      </IconButton>
      <IconButton label="Previous" onClick={player.previous}>
        <SkipBack aria-hidden="true" />
      </IconButton>
      <button
        type="button"
        onClick={player.toggle}
        aria-label={playing ? 'Pause' : 'Play'}
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-card transition-transform hover:scale-105',
          size === 'lg' ? 'size-16 [&_svg]:size-7' : 'size-10 [&_svg]:size-5',
        )}
      >
        {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" className="ms-0.5" />}
      </button>
      <IconButton label="Next" onClick={player.next}>
        <SkipForward aria-hidden="true" />
      </IconButton>
      <IconButton
        label={
          player.repeat === 'one'
            ? 'Stop repeating'
            : player.repeat === 'all'
              ? 'Repeat this one only'
              : 'Repeat everything'
        }
        onClick={player.cycleRepeat}
        active={player.repeat !== 'off'}
      >
        {player.repeat === 'one' ? <Repeat1 aria-hidden="true" /> : <Repeat aria-hidden="true" />}
      </IconButton>
    </div>
  );

  const artwork = (size: 'sm' | 'lg') => (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary-soft text-primary-soft-foreground',
        size === 'lg' ? 'size-56 rounded-2xl [&_svg]:size-16' : 'size-11 [&_svg]:size-5',
      )}
    >
      {current.artworkUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={current.artworkUrl} alt="" className="size-full object-cover" />
      ) : (
        <Music2 aria-hidden="true" />
      )}
    </span>
  );

  return (
    <>
      {/* The full screen, on a phone. */}
      {expanded ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-background p-5 md:hidden">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label="Close the player"
              className="flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface-muted"
            >
              <ChevronDown aria-hidden="true" />
            </button>
            {current.kind ? (
              <span className="text-xs font-medium tracking-wide text-muted uppercase">
                {current.kind}
              </span>
            ) : null}
            <span className="size-10" />
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-6">
            {artwork('lg')}
            <div className="w-full text-center">
              <Link href={current.path} className="text-xl font-semibold hover:underline">
                {current.title}
              </Link>
              {current.artist ? <p className="mt-1 text-muted">{current.artist}</p> : null}
            </div>
            <div className="w-full">{scrubber}</div>
            {transport('lg')}
            {problem ? <p className="text-sm text-warning">{problem}</p> : null}
          </div>
        </div>
      ) : null}

      {/* The bar. Sits above the phone's tab bar so it never covers it. */}
      <div
        className={cn(
          'fixed inset-x-0 bottom-16 z-40 border-t border-border bg-surface/95 backdrop-blur md:bottom-0',
          expanded && 'hidden md:block',
        )}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left md:cursor-default"
            aria-label={`Now playing: ${current.title}. Open the player.`}
          >
            {artwork('sm')}
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{current.title}</span>
              <span className="block truncate text-xs text-muted">
                {problem ?? current.artist ?? current.kind ?? ''}
              </span>
            </span>
          </button>

          <div className="hidden flex-[2] flex-col gap-1 md:flex">
            {transport('sm')}
            {scrubber}
          </div>

          {/* On a phone only play/pause fits; the rest is one tap away on the full screen. */}
          <button
            type="button"
            onClick={player.toggle}
            aria-label={playing ? 'Pause' : 'Play'}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground md:hidden [&_svg]:size-5"
          >
            {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </button>

          <div className="hidden items-center gap-1 md:flex">
            <IconButton
              label={player.muted ? 'Unmute' : 'Mute'}
              onClick={() => player.setMuted(!player.muted)}
            >
              {player.muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
            </IconButton>
            <IconButton label="Close the player" onClick={player.close}>
              <X aria-hidden="true" />
            </IconButton>
          </div>
        </div>
      </div>
    </>
  );
}

function IconButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-surface-muted [&_svg]:size-4',
        active ? 'text-link' : 'text-muted hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
