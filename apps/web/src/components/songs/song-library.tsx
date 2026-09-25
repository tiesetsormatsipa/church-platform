'use client';

import type { ContentSummary, MediaFacetsDto, SongsPage } from '@church/shared';
import { languageName } from '@church/shared';
import { EmptyState } from '@church/ui/empty-state';
import { chipClass } from '@church/ui/segmented';
import { cn } from '@church/ui/lib/cn';
import { Music, Play } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { formatDuration, Player, toTrack } from './player';

interface Props {
  page: SongsPage;
}

/**
 * The song library and its player.
 *
 * Filters are search parameters, so a filtered library can be linked to and shared, the back
 * button behaves, and the server renders the right list first time. Only the playing state
 * lives in the browser.
 */
export function SongLibrary({ page }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [index, setIndex] = React.useState<number | null>(null);

  const tracks = React.useMemo(() => page.items.map(toTrack), [page.items]);

  function withParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value === null) next.delete(key);
    else next.set(key, value);
    next.delete('cursor');
    const query = next.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  function setParam(key: string, value: string | null) {
    setIndex(null);
    router.push(withParam(key, value), { scroll: false });
  }

  const current = params.get('collection');
  const language = params.get('language');
  const album = params.get('album');

  return (
    <div className="flex flex-col gap-6">
      <Filters
        facets={page.facets}
        albums={page.albums}
        collection={current}
        language={language}
        album={album}
        onChange={setParam}
      />

      {page.items.length === 0 ? (
        <EmptyState
          icon={<Music aria-hidden="true" />}
          title="No songs here yet"
          description="Try another language or collection, or come back once the auxiliary has posted some."
        />
      ) : (
        <ol className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
          {page.items.map((song, i) => (
            <SongRow
              key={song.id}
              song={song}
              position={i + 1}
              playing={index === i}
              onPlay={() => setIndex(i)}
            />
          ))}
        </ol>
      )}

      <Player queue={tracks} index={index} onIndexChange={setIndex} />
    </div>
  );
}

function SongRow({
  song,
  position,
  playing,
  onPlay,
}: {
  song: ContentSummary;
  position: number;
  playing: boolean;
  onPlay: () => void;
}) {
  const detail = song.song;
  return (
    <li className={cn('flex items-center gap-3 px-4 py-3', playing && 'bg-surface-muted')}>
      <button
        type="button"
        onClick={onPlay}
        aria-label={`Play ${song.title}`}
        aria-pressed={playing}
        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {playing ? (
          <span aria-hidden="true" className="size-2.5 rounded-sm bg-primary" />
        ) : (
          <Play aria-hidden="true" className="size-4" />
        )}
      </button>
      <span className="w-5 shrink-0 text-end text-xs text-muted tabular-nums">{position}</span>
      <span className="min-w-0 flex-1">
        <Link href={song.path} className={cn('block truncate font-medium', playing && 'text-link')}>
          {song.title}
        </Link>
        <span className="block truncate text-sm text-muted">
          {[detail?.artist, detail?.album].filter(Boolean).join(' · ') || 'Song'}
        </span>
      </span>
      {detail?.language ? (
        <span className="hidden shrink-0 text-xs text-muted sm:inline">
          {languageName(detail.language)}
        </span>
      ) : null}
      <span className="w-12 shrink-0 text-end text-sm text-muted tabular-nums">
        {formatDuration(detail?.durationSeconds)}
      </span>
    </li>
  );
}

function Filters({
  facets,
  albums,
  collection,
  language,
  album,
  onChange,
}: {
  facets: MediaFacetsDto;
  albums: SongsPage['albums'];
  collection: string | null;
  language: string | null;
  album: string | null;
  onChange: (key: string, value: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {facets.collections.length > 1 ? (
        <Row label="Collection">
          <Chip active={!collection} onClick={() => onChange('collection', null)}>
            Everything
          </Chip>
          {facets.collections.map((c) => (
            <Chip
              key={c.value}
              active={collection === c.value}
              onClick={() => onChange('collection', c.value)}
            >
              {c.label} <Count n={c.count} />
            </Chip>
          ))}
        </Row>
      ) : null}

      {facets.languages.length > 1 ? (
        <Row label="Language">
          <Chip active={!language} onClick={() => onChange('language', null)}>
            All languages
          </Chip>
          {facets.languages.map((l) => (
            <Chip
              key={l.code}
              active={language === l.code}
              onClick={() => onChange('language', l.code)}
            >
              {l.name} <Count n={l.count} />
            </Chip>
          ))}
        </Row>
      ) : null}

      {albums.length > 1 ? (
        <Row label="Album">
          <Chip active={!album} onClick={() => onChange('album', null)}>
            All albums
          </Chip>
          {albums.map((a) => (
            <Chip key={a.name} active={album === a.name} onClick={() => onChange('album', a.name)}>
              {a.name} <Count n={a.count} />
            </Chip>
          ))}
        </Row>
      ) : null}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
      {/* `relative` so the sr-only text inside chips cannot escape and widen the page. */}
      <div className="relative -mx-4 mt-2 scrollbar-none overflow-x-auto px-4">
        <div className="flex w-max gap-1.5">{children}</div>
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={chipClass(active)}>
      {children}
    </button>
  );
}

function Count({ n }: { n: number }) {
  return <span className="ms-1 text-xs opacity-70">{n}</span>;
}
