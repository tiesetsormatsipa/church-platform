// apps/web/src/app/songs/page.tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Play, Pause, Search, Music, Heart, SkipForward,
  SkipBack, Volume2, Repeat, Shuffle, Plus, Upload,
  Mic2, Clock, ChevronRight,
} from 'lucide-react';
import { FeatureGate } from '@/components/layout/FeatureGate';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

// ---- Global audio player state ----
let currentAudio: HTMLAudioElement | null = null;

function formatDuration(seconds: number) {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function SongRow({
  song, index, isPlaying, onPlay, onLike, isLiked,
}: {
  song: any; index: number; isPlaying: boolean;
  onPlay: () => void; onLike: () => void; isLiked: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className={cn(
        'group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150',
        'hover:bg-charcoal-50 cursor-pointer',
        isPlaying && 'bg-gold/5 border border-gold/20',
      )}
    >
      {/* Track number / play indicator */}
      <div className="w-8 flex-shrink-0 text-center">
        {isPlaying ? (
          <div className="flex items-end justify-center gap-0.5 h-4">
            {[1, 2, 3].map((b) => (
              <motion.div
                key={b}
                className="w-1 bg-gold rounded-full"
                animate={{ height: [4, 12, 6, 10, 4] }}
                transition={{ repeat: Infinity, duration: 1, delay: b * 0.15 }}
              />
            ))}
          </div>
        ) : (
          <>
            <span className="text-charcoal-400 text-sm font-body group-hover:hidden">
              {index + 1}
            </span>
            <button onClick={onPlay} className="hidden group-hover:flex items-center justify-center">
              <Play className="w-4 h-4 text-navy" />
            </button>
          </>
        )}
      </div>

      {/* Song info */}
      <div className="flex-1 min-w-0" onClick={onPlay}>
        <p className={cn(
          'font-body font-semibold text-sm truncate',
          isPlaying ? 'text-gold-700' : 'text-navy',
        )}>
          {song.title}
        </p>
        <p className="font-body text-xs text-charcoal-400 truncate">
          {song.artist || song.uploader?.profile
            ? `${song.uploader?.profile?.firstName} ${song.uploader?.profile?.surname}`
            : 'Unknown Artist'}
          {song.album && ` · ${song.album}`}
        </p>
      </div>

      {/* Language badge */}
      {song.language && (
        <span className="hidden sm:block text-xs bg-navy/5 text-navy border border-navy/10 rounded-full px-2 py-0.5 font-body flex-shrink-0">
          {song.language.toUpperCase()}
        </span>
      )}

      {/* Likes */}
      <button
        onClick={(e) => { e.stopPropagation(); onLike(); }}
        className={cn(
          'flex items-center gap-1 text-xs font-body flex-shrink-0 transition-colors',
          isLiked ? 'text-church-red' : 'text-charcoal-300 hover:text-church-red',
        )}
      >
        <Heart className={cn('w-4 h-4', isLiked && 'fill-current')} />
        <span className="hidden sm:block">{song._count?.likes || 0}</span>
      </button>

      {/* Duration */}
      <span className="text-xs text-charcoal-400 font-body flex-shrink-0 w-10 text-right">
        {formatDuration(song.audioAsset?.durationSeconds)}
      </span>
    </motion.div>
  );
}

function MiniPlayer({ song, onClose }: { song: any; onClose: () => void }) {
  const [playing, setPlaying]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [vol, setVol]           = useState(80);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = vol / 100;
      audioRef.current.play().then(() => setPlaying(true)).catch(() => {});
    }
  }, [song.id]);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      exit={{ y: 100 }}
      className="fixed bottom-0 left-0 right-0 z-50 bg-navy border-t border-gold/20 px-4 py-3 shadow-2xl"
    >
      <audio
        ref={audioRef}
        src={song.audioAsset?.url}
        onTimeUpdate={(e) => {
          const t = e.currentTarget;
          setProgress(t.duration ? (t.currentTime / t.duration) * 100 : 0);
        }}
        onEnded={() => setPlaying(false)}
      />

      {/* Progress bar at top */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/10">
        <div className="h-full bg-gold transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="max-w-5xl mx-auto flex items-center gap-4">
        {/* Song info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-gold/20 flex items-center justify-center flex-shrink-0">
            <Music className="w-5 h-5 text-gold" />
          </div>
          <div className="min-w-0">
            <p className="font-body font-semibold text-white text-sm truncate">{song.title}</p>
            <p className="font-body text-white/50 text-xs truncate">
              {song.artist || song.uploader?.profile?.firstName}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button className="p-1.5 text-white/40 hover:text-white/70 transition-colors">
            <Shuffle className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-white/50 hover:text-white transition-colors">
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={toggle}
            className="w-10 h-10 rounded-full bg-gold flex items-center justify-center hover:bg-gold-600 transition-colors shadow-gold"
          >
            {playing
              ? <Pause className="w-4 h-4 text-navy" />
              : <Play  className="w-4 h-4 text-navy ml-0.5" />
            }
          </button>
          <button className="p-1.5 text-white/50 hover:text-white transition-colors">
            <SkipForward className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-white/40 hover:text-white/70 transition-colors">
            <Repeat className="w-4 h-4" />
          </button>
        </div>

        {/* Volume */}
        <div className="hidden sm:flex items-center gap-2 flex-1 max-w-xs justify-end">
          <Volume2 className="w-4 h-4 text-white/40 flex-shrink-0" />
          <input
            type="range" min={0} max={100} value={vol}
            onChange={(e) => {
              const v = parseInt(e.target.value);
              setVol(v);
              if (audioRef.current) audioRef.current.volume = v / 100;
            }}
            className="audio-progress w-24"
          />
          <button onClick={onClose} className="ml-2 text-white/30 hover:text-white/60 text-lg">×</button>
        </div>
      </div>
    </motion.div>
  );
}

export default function SongsPage() {
  return (
    <FeatureGate featureKey="praise_songs">
      <SongsContent />
    </FeatureGate>
  );
}

function SongsContent() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [tab, setTab]             = useState<'CHURCH' | 'MEMBERS'>('CHURCH');
  const [search, setSearch]       = useState('');
  const [playingSong, setPlaying] = useState<any>(null);
  const [likedIds, setLikedIds]   = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['songs', tab, search],
    queryFn: () =>
      api.get('/api/v1/songs', {
        params: { tab, search: search || undefined, status: 'PUBLISHED', limit: 50 },
      }).then((r) => r.data),
  });

  const likeMutation = useMutation({
    mutationFn: (songId: string) => api.post(`/api/v1/songs/${songId}/like`).then((r) => r.data),
    onSuccess: (data, songId) => {
      setLikedIds((prev) => {
        const next = new Set(prev);
        data.liked ? next.add(songId) : next.delete(songId);
        return next;
      });
      qc.invalidateQueries({ queryKey: ['songs'] });
    },
  });

  const songs = data?.data || [];

  return (
    <div className="pt-16 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-navy-gradient py-14 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 church-pattern opacity-10" />
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gold-gradient" />
        <div className="max-w-4xl mx-auto relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-0.5 bg-gold" />
              <span className="text-gold text-sm font-body uppercase tracking-wider">Music</span>
            </div>
            <h1 className="font-heading font-bold text-white text-5xl mb-3">Praise Songs</h1>
            <p className="text-white/60 font-body text-lg">
              Worship through music. Songs from the church community.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Tabs and search */}
      <div className="bg-white border-b border-charcoal-100 sticky top-16 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row gap-3">
          <div className="flex gap-2">
            {[
              { key: 'CHURCH',  label: 'Church Songs',    icon: Music },
              { key: 'MEMBERS', label: "Members' Songs",  icon: Mic2  },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key as typeof tab)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-body font-medium transition-all',
                  tab === key ? 'bg-navy text-white' : 'text-charcoal-500 hover:bg-charcoal-50',
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-sm sm:ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
            <input
              type="text"
              placeholder="Song title, artist..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-charcoal-200 rounded-lg text-sm font-body focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
          </div>
        </div>
      </div>

      {/* Songs list */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Header row */}
        <div className="flex items-center gap-3 px-4 mb-2 text-xs text-charcoal-400 font-body uppercase tracking-wider">
          <div className="w-8 text-center">#</div>
          <div className="flex-1">Title</div>
          <div className="hidden sm:block w-16 text-center">Language</div>
          <div className="w-12 text-center">Likes</div>
          <div className="w-10 text-right">Time</div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-14 skeleton rounded-xl" />
            ))}
          </div>
        ) : songs.length === 0 ? (
          <div className="text-center py-20">
            <Music className="w-12 h-12 text-charcoal-200 mx-auto mb-3" />
            <p className="font-body text-charcoal-400">No songs found.</p>
            {tab === 'MEMBERS' && (
              <p className="text-sm text-charcoal-400 font-body mt-2">
                Members can upload songs after approval.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {songs.map((song: any, i: number) => (
              <SongRow
                key={song.id}
                song={song}
                index={i}
                isPlaying={playingSong?.id === song.id}
                isLiked={likedIds.has(song.id)}
                onPlay={() => setPlaying(playingSong?.id === song.id ? null : song)}
                onLike={() => user && likeMutation.mutate(song.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Mini player */}
      {playingSong && (
        <MiniPlayer song={playingSong} onClose={() => setPlaying(null)} />
      )}
    </div>
  );
}
