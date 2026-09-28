'use client';

import * as React from 'react';

export interface Track {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  durationSeconds: number | null;
  audioUrl: string | null;
  /** Where the thing itself lives, for the title in the bar to link to. */
  path: string;
  /** Sermon, song — shown in the bar so a long queue is not a mystery. */
  kind?: string;
  artworkUrl?: string | null;
}

export type RepeatMode = 'off' | 'all' | 'one';

interface PlayerState {
  queue: Track[];
  index: number | null;
  playing: boolean;
  position: number;
  duration: number | null;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  /** Set when a track has no recording, or the browser could not play it. */
  problem: string | null;
}

interface PlayerActions {
  /** Start a queue at one of its tracks. The usual way to begin listening. */
  play: (queue: Track[], index?: number) => void;
  /** Put one track after the current one. */
  playNext: (track: Track) => void;
  /** Put one track at the end of the queue. */
  enqueue: (track: Track) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  jumpTo: (index: number) => void;
  setMuted: (muted: boolean) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  /** Stop and clear, which takes the bar off the screen. */
  close: () => void;
}

export type Player = PlayerState & PlayerActions & { current: Track | null };

const PlayerContext = React.createContext<Player | null>(null);

/** Everything a page needs to start or steer playback. */
export function usePlayer(): Player {
  const player = React.useContext(PlayerContext);
  if (!player) throw new Error('usePlayer must be used inside <PlayerProvider>');
  return player;
}

/** Is this the track that is playing right now? For highlighting a row in a list. */
export function useIsPlaying(trackId: string): boolean {
  const { current, playing } = usePlayer();
  return playing && current?.id === trackId;
}

const INITIAL: PlayerState = {
  queue: [],
  index: null,
  playing: false,
  position: 0,
  duration: null,
  muted: false,
  shuffle: false,
  repeat: 'off',
  problem: null,
};

/**
 * One `<audio>` element for the whole site, owned here rather than by any page.
 *
 * This is what lets a sermon keep playing while somebody reads the news: the element is
 * mounted once, in the root layout, and navigating only changes what is rendered around it.
 * A player that lives on a page stops the moment the page unmounts, which is the one thing
 * people would not forgive.
 */
export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [state, setState] = React.useState<PlayerState>(INITIAL);
  /** The order shuffle plays in; regenerated whenever shuffle is turned on. */
  const order = React.useRef<number[] | null>(null);

  const current = state.index === null ? null : (state.queue[state.index] ?? null);

  const patch = React.useCallback((next: Partial<PlayerState>) => {
    setState((s) => ({ ...s, ...next }));
  }, []);

  const shuffled = React.useCallback((length: number, keep: number) => {
    const rest = Array.from({ length }, (_, i) => i).filter((i) => i !== keep);
    for (let i = rest.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j]!, rest[i]!];
    }
    return [keep, ...rest];
  }, []);

  const play = React.useCallback((queue: Track[], index = 0) => {
    order.current = null;
    setState((s) => ({
      ...s,
      queue,
      index,
      playing: true,
      position: 0,
      duration: queue[index]?.durationSeconds ?? null,
      problem: null,
      ...(s.shuffle ? {} : {}),
    }));
  }, []);

  const step = React.useCallback((delta: 1 | -1) => {
    setState((s) => {
      if (s.index === null || s.queue.length === 0) return s;
      if (s.shuffle && order.current) {
        const at = order.current.indexOf(s.index);
        const nextAt = at + delta;
        if (nextAt < 0 || nextAt >= order.current.length) {
          if (s.repeat !== 'all') return { ...s, playing: false };
          const wrapped =
            ((nextAt % order.current.length) + order.current.length) % order.current.length;
          return {
            ...s,
            index: order.current[wrapped]!,
            position: 0,
            playing: true,
            problem: null,
          };
        }
        return { ...s, index: order.current[nextAt]!, position: 0, playing: true, problem: null };
      }
      const next = s.index + delta;
      if (next < 0) return { ...s, index: 0, position: 0 };
      if (next >= s.queue.length) {
        if (s.repeat !== 'all') return { ...s, playing: false };
        return { ...s, index: 0, position: 0, playing: true, problem: null };
      }
      return { ...s, index: next, position: 0, playing: true, problem: null };
    });
  }, []);

  const actions = React.useMemo<PlayerActions>(
    () => ({
      play,
      playNext: (track) =>
        setState((s) => {
          const at = s.index === null ? s.queue.length : s.index + 1;
          const queue = [...s.queue.slice(0, at), track, ...s.queue.slice(at)];
          return { ...s, queue };
        }),
      enqueue: (track) => setState((s) => ({ ...s, queue: [...s.queue, track] })),
      toggle: () => setState((s) => (s.index === null ? s : { ...s, playing: !s.playing })),
      next: () => step(1),
      previous: () =>
        setState((s) => {
          // The first press restarts the track, as every player does; only near the very
          // start does it go back one.
          if (s.position > 3) {
            if (audioRef.current) audioRef.current.currentTime = 0;
            return { ...s, position: 0 };
          }
          return s;
        }),
      seek: (seconds) => {
        if (audioRef.current) audioRef.current.currentTime = seconds;
        patch({ position: seconds });
      },
      jumpTo: (index) => patch({ index, position: 0, playing: true, problem: null }),
      setMuted: (muted) => patch({ muted }),
      toggleShuffle: () =>
        setState((s) => {
          const shuffle = !s.shuffle;
          order.current = shuffle && s.index !== null ? shuffled(s.queue.length, s.index) : null;
          return { ...s, shuffle };
        }),
      cycleRepeat: () =>
        setState((s) => ({
          ...s,
          repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off',
        })),
      close: () => {
        order.current = null;
        setState(INITIAL);
      },
    }),
    [play, patch, shuffled, step],
  );

  // "Previous" near the start of a track has to reach `step`, which the action above cannot
  // see; this keeps the two halves of that behaviour together.
  const previous = React.useCallback(() => {
    if ((audioRef.current?.currentTime ?? 0) > 3) {
      if (audioRef.current) audioRef.current.currentTime = 0;
      patch({ position: 0 });
      return;
    }
    step(-1);
  }, [patch, step]);

  // Keep the element in step with what the state says should be happening.
  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!current?.audioUrl) return;
    if (state.playing) {
      void audio.play().catch(() => {
        // Autoplay refused, or the file will not decode. Either way the person should be
        // told rather than left looking at a button that does nothing.
        setState((s) => ({ ...s, playing: false, problem: 'That recording would not play.' }));
      });
    } else {
      audio.pause();
    }
  }, [state.playing, current?.audioUrl, current?.id]);

  // A track with no file is not an error that happened; it is simply how that row is.
  const problem =
    state.problem ?? (current && !current.audioUrl ? 'No recording has been uploaded yet.' : null);

  const value = React.useMemo<Player>(
    () => ({
      ...state,
      ...actions,
      previous,
      current,
      problem,
      playing: state.playing && !!current?.audioUrl,
    }),
    [state, actions, previous, current, problem],
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}
      {/* No captions to offer: these are recordings of services, and where the words exist
          they are a transcript on the item's own page. An empty <track> would claim
          otherwise. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        src={current?.audioUrl ?? undefined}
        muted={state.muted}
        onTimeUpdate={(e) => patch({ position: e.currentTarget.currentTime })}
        onLoadedMetadata={(e) =>
          patch({
            duration: Number.isFinite(e.currentTarget.duration)
              ? e.currentTarget.duration
              : (current?.durationSeconds ?? null),
          })
        }
        onEnded={() => {
          if (state.repeat === 'one' && audioRef.current) {
            audioRef.current.currentTime = 0;
            void audioRef.current.play().catch(() => undefined);
            return;
          }
          step(1);
        }}
        onError={() => patch({ playing: false, problem: 'That recording would not play.' })}
        preload="metadata"
        className="hidden"
      />
    </PlayerContext.Provider>
  );
}
