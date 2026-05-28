// apps/web/src/app/sermons/page.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Play, Pause, Search, BookOpen, Mic2, Clock,
  MapPin, Calendar, ChevronRight, Volume2, SkipForward, SkipBack,
} from 'lucide-react';
import { FeatureGate } from '@/components/layout/FeatureGate';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

function AudioPlayerBar({ sermon, onClose }: { sermon: any; onClose: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.play().then(() => setPlaying(true)).catch(() => {});
    }
  }, [sermon.id]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ y: 80 }}
      animate={{ y: 0 }}
      exit={{ y: 80 }}
      className="fixed bottom-0 left-0 right-0 z-50 bg-navy border-t border-gold/20 px-4 py-3 shadow-navy"
    >
      <audio
        ref={audioRef}
        src={sermon.audioAsset?.url}
        onTimeUpdate={(e) => {
          const t = e.currentTarget;
          setCurrentTime(t.currentTime);
          setProgress(t.duration ? (t.currentTime / t.duration) * 100 : 0);
        }}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => setPlaying(false)}
      />

      <div className="max-w-4xl mx-auto flex items-center gap-4">
        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-body font-semibold text-white text-sm truncate">{sermon.title}</p>
          <p className="font-body text-white/50 text-xs truncate">{sermon.minister}</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button className="p-1.5 text-white/50 hover:text-white transition-colors">
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={togglePlay}
            className="w-9 h-9 rounded-full bg-gold flex items-center justify-center hover:bg-gold-600 transition-colors"
          >
            {playing
              ? <Pause className="w-4 h-4 text-navy" />
              : <Play  className="w-4 h-4 text-navy ml-0.5" />
            }
          </button>
          <button className="p-1.5 text-white/50 hover:text-white transition-colors">
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Progress */}
        <div className="hidden sm:flex items-center gap-2 flex-1 max-w-xs">
          <span className="text-white/40 text-xs font-body">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={progress}
            onChange={(e) => {
              if (audioRef.current) {
                audioRef.current.currentTime = (parseFloat(e.target.value) / 100) * duration;
              }
            }}
            className="audio-progress flex-1"
          />
          <span className="text-white/40 text-xs font-body">{formatTime(duration)}</span>
        </div>

        {/* Close */}
        <button onClick={onClose} className="p-2 text-white/40 hover:text-white transition-colors">
          ×
        </button>
      </div>
    </motion.div>
  );
}

function SermonCard({ sermon, onPlay, isPlaying }: { sermon: any; onPlay: () => void; isPlaying: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-white rounded-2xl border shadow-card p-5',
        'hover:shadow-gold hover:border-gold/30 transition-all duration-200',
        isPlaying ? 'border-gold/40 bg-gold/5' : 'border-charcoal-100',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-heading font-bold text-navy text-lg mb-1 leading-snug">
            {sermon.title}
          </h3>
          <div className="flex flex-wrap gap-3 text-sm text-charcoal-500 font-body mb-3">
            <span className="flex items-center gap-1.5">
              <Mic2 className="w-3.5 h-3.5 text-gold flex-shrink-0" />
              {sermon.minister}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-charcoal-400 flex-shrink-0" />
              {new Date(sermon.date).toLocaleDateString('en-ZA', { dateStyle: 'medium' })}
            </span>
            {sermon.duration && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-charcoal-400 flex-shrink-0" />
                {Math.floor(sermon.duration / 60)}m
              </span>
            )}
          </div>

          {sermon.description && (
            <p className="text-charcoal-500 text-sm font-body line-clamp-2 mb-3">
              {sermon.description}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {sermon.language && (
              <span className="text-xs bg-navy/5 text-navy border border-navy/10 rounded-full px-2.5 py-0.5 font-body">
                {sermon.language.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* Play button */}
        <button
          onClick={onPlay}
          className={cn(
            'flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all',
            isPlaying
              ? 'bg-gold text-navy shadow-gold'
              : 'bg-navy text-white hover:bg-gold hover:text-navy',
          )}
        >
          {isPlaying
            ? <Pause className="w-5 h-5" />
            : <Play  className="w-5 h-5 ml-0.5" />
          }
        </button>
      </div>
    </motion.div>
  );
}

export default function SermonsPage() {
  return (
    <FeatureGate featureKey="sermons">
      <SermonsContent />
    </FeatureGate>
  );
}

function SermonsContent() {
  const [tab, setTab]               = useState<'MINISTERS' | 'TOG'>('MINISTERS');
  const [search, setSearch]         = useState('');
  const [playingSermon, setPlaying] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['sermons', tab, search],
    queryFn: () =>
      api.get('/api/v1/sermons', {
        params: { tab, search: search || undefined, status: 'PUBLISHED', limit: 20 },
      }).then((r) => r.data),
  });

  const sermons = data?.data || [];

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
              <span className="text-gold text-sm font-body uppercase tracking-wider">The Word</span>
            </div>
            <h1 className="font-heading font-bold text-white text-5xl mb-3">Sermons</h1>
            <p className="text-white/60 font-body text-lg">
              Listen to the Word of God. Faith comes by hearing.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Tabs & search */}
      <div className="bg-white border-b border-charcoal-100 sticky top-16 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row gap-3">
          <div className="flex gap-2">
            {[
              { key: 'MINISTERS', label: "Ministers' Sermons",   icon: BookOpen },
              { key: 'TOG',       label: 'Truth of God (TOG)',    icon: Volume2  },
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
              placeholder="Search minister, date, keyword..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-charcoal-200 rounded-lg text-sm font-body focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
          </div>
        </div>
      </div>

      {/* Sermons list */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-4">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-36 skeleton rounded-2xl" />
            ))
          : sermons.length === 0
          ? (
            <div className="text-center py-20">
              <BookOpen className="w-12 h-12 text-charcoal-200 mx-auto mb-3" />
              <p className="font-body text-charcoal-400">No sermons found.</p>
            </div>
          )
          : sermons.map((s: any) => (
              <SermonCard
                key={s.id}
                sermon={s}
                isPlaying={playingSermon?.id === s.id}
                onPlay={() =>
                  setPlaying(playingSermon?.id === s.id ? null : s)
                }
              />
            ))
        }
      </div>

      {/* Audio player */}
      {playingSermon && (
        <AudioPlayerBar sermon={playingSermon} onClose={() => setPlaying(null)} />
      )}
    </div>
  );
}
