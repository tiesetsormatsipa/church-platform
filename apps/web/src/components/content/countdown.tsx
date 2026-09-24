'use client';

import { useSyncExternalStore } from 'react';

function parts(target: number, now: number) {
  const diff = Math.max(0, target - now);
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return { days, hours, minutes, done: diff === 0 };
}

const TICK_MS = 30_000;

function subscribe(onTick: () => void): () => void {
  const id = setInterval(onTick, 5_000);
  return () => clearInterval(id);
}

/** Current time rounded to the tick, so the snapshot is stable between ticks. */
const clock = () => Math.floor(Date.now() / TICK_MS) * TICK_MS;

/**
 * Days / hours / minutes until an event. Updates every 30 s without announcing each tick to
 * screen readers; the accessible label states the event date instead.
 */
export function Countdown({ startsAt, label }: { startsAt: string; label: string }) {
  const target = new Date(startsAt).getTime();
  // Null on the server and during hydration, so server and client markup match.
  const now = useSyncExternalStore(subscribe, clock, () => null);
  if (now === null) return <div className="h-16" aria-hidden="true" />;
  const { days, hours, minutes, done } = parts(target, now);
  if (done) return <p className="text-sm font-medium text-success">Happening now</p>;
  const units = [
    { value: days, unit: days === 1 ? 'day' : 'days' },
    { value: hours, unit: hours === 1 ? 'hour' : 'hours' },
    { value: minutes, unit: minutes === 1 ? 'minute' : 'minutes' },
  ];
  return (
    <div role="timer" aria-label={label} className="flex gap-2">
      {units.map((u) => (
        <div key={u.unit} className="flex min-w-16 flex-col items-center rounded-lg bg-primary-soft px-3 py-2" aria-hidden="true">
          <span className="font-serif text-2xl leading-none font-semibold text-primary-soft-foreground tabular-nums">{u.value}</span>
          <span className="mt-1 text-xs text-muted">{u.unit}</span>
        </div>
      ))}
    </div>
  );
}
