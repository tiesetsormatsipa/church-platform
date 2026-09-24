// apps/web/src/app/branches/[id]/page.tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import {
  MapPin, Users, Clock, Calendar, ChevronLeft, GitBranch,
  Building2, Phone, Mail, BookOpen, Heart, Camera,
  ChevronDown, ChevronUp, Bell, Shield,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function ServiceTimeCard({ time }: { time: any }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-navy/5 rounded-xl">
      <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center flex-shrink-0">
        <Clock className="w-4 h-4 text-gold" />
      </div>
      <div>
        <p className="font-body font-semibold text-navy text-sm">{DAYS[time.dayOfWeek]}</p>
        <p className="font-body text-charcoal-500 text-xs">{time.startTime} – {time.endTime}
          {time.label && <span className="ml-1 text-charcoal-400">· {time.label}</span>}
        </p>
      </div>
    </div>
  );
}

function LeaderCard({ leader }: { leader: any }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white border border-charcoal-100 rounded-xl">
      <div className="w-10 h-10 rounded-full bg-navy/5 flex items-center justify-center flex-shrink-0">
        <Shield className="w-5 h-5 text-gold/60" />
      </div>
      <div>
        <p className="font-body font-semibold text-navy text-sm">{leader.name}</p>
        <p className="font-body text-charcoal-400 text-xs">{leader.position}</p>
      </div>
    </div>
  );
}

function AnnouncementItem({ ann }: { ann: any }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="p-4 border border-charcoal-100 rounded-xl bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          {ann.isPinned && (
            <span className="inline-flex items-center gap-1 text-xs bg-gold/10 text-gold-700 border border-gold/20 rounded-full px-2 py-0.5 mb-2 font-body">
              📌 Pinned
            </span>
          )}
          <h4 className="font-body font-semibold text-navy text-sm mb-1">{ann.title}</h4>
          <p className={cn('font-body text-charcoal-500 text-xs leading-relaxed transition-all', expanded ? '' : 'line-clamp-2')}>
            {ann.content}
          </p>
        </div>
      </div>
      {ann.content?.length > 100 && (
        <button onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs text-gold-700 font-body flex items-center gap-1">
          {expanded ? <><ChevronUp className="w-3 h-3" />Less</> : <><ChevronDown className="w-3 h-3" />More</>}
        </button>
      )}
    </div>
  );
}

export default function BranchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState('info');

  const { data: branch, isLoading } = useQuery({
    queryKey: ['branch', id],
    queryFn: () => api.get(`/api/v1/branches/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const { data: serviceTimes } = useQuery({
    queryKey: ['branch-service-times', id],
    queryFn: () => api.get(`/api/v1/branches/${id}/service-times`).then((r) => r.data),
    enabled: !!id,
  });

  if (isLoading) return (
    <div className="pt-16 min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!branch) return (
    <div className="pt-16 min-h-screen flex items-center justify-center">
      <p className="text-charcoal-400 font-body">Branch not found.</p>
    </div>
  );

  const TABS = [
    { key: 'info',          label: 'Info' },
    { key: 'services',      label: 'Services' },
    { key: 'leadership',    label: 'Leadership' },
    { key: 'announcements', label: 'Notices' },
    { key: 'gallery',       label: 'Gallery' },
  ];

  const isMain = branch.type === 'MAIN';
  const currentTimes = serviceTimes?.times || branch.serviceTimes || [];
  const isTemporary = serviceTimes?.type === 'TEMPORARY';

  return (
    <div className="pt-16 min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="relative h-72 bg-navy overflow-hidden">
        {branch.heroImageUrl ? (
          <img
            src={branch.heroImageUrl}
            alt={branch.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-navy-gradient flex items-center justify-center">
            <Building2 className="w-24 h-24 text-gold/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/40 to-transparent" />
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gold-gradient" />

        {/* Back button */}
        <Link
          href="/branches"
          className="absolute top-4 left-4 flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm font-body px-3 py-1.5 rounded-lg hover:bg-white/20 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Branches
        </Link>

        {/* Branch type badge */}
        <div className="absolute top-4 right-4">
          <span className={cn(
            'text-xs font-body font-semibold px-3 py-1.5 rounded-full',
            isMain ? 'bg-gold text-navy' : 'bg-white/90 text-charcoal-600',
          )}>
            {isMain ? 'Main Branch' : 'Sub-branch'}
          </span>
        </div>

        {/* Branch name overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {branch.parentBranch && (
              <p className="text-gold/70 text-sm font-body mb-1">
                Under {branch.parentBranch.name}
              </p>
            )}
            <h1 className="font-heading font-bold text-white text-3xl sm:text-4xl mb-1">
              {branch.name}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-white/60 text-sm font-body">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-gold" />
                {[branch.city?.name, branch.province?.name, branch.country?.name].filter(Boolean).join(', ')}
              </span>
              {branch.estimatedMembers && (
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" /> ~{branch.estimatedMembers.toLocaleString()} members
                </span>
              )}
              {branch.subBranches?.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <GitBranch className="w-4 h-4" /> {branch.subBranches.length} sub-branches
                </span>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Sticky tabs */}
      <div className="bg-white border-b border-charcoal-100 sticky top-16 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex gap-0 overflow-x-auto scrollbar-hide">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex-shrink-0 px-4 py-4 text-sm font-body font-medium border-b-2 transition-all',
                  activeTab === tab.key
                    ? 'border-gold text-gold-700'
                    : 'border-transparent text-charcoal-500 hover:text-navy',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {/* INFO TAB */}
            {activeTab === 'info' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Details card */}
                <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card p-6">
                  <h2 className="font-heading font-bold text-navy text-xl mb-4">Branch Details</h2>
                  <div className="space-y-3">
                    {branch.address && (
                      <div className="flex items-start gap-3">
                        <MapPin className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                        <p className="font-body text-charcoal-600 text-sm">{branch.address}</p>
                      </div>
                    )}
                    {branch.googleMapsUrl && (
                      <a
                        href={branch.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-gold-700 font-body hover:text-gold transition-colors"
                      >
                        <MapPin className="w-4 h-4" />
                        View on Google Maps ↗
                      </a>
                    )}
                  </div>
                </div>

                {/* Sub-branches */}
                {branch.subBranches?.length > 0 && (
                  <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card p-6">
                    <h2 className="font-heading font-bold text-navy text-xl mb-4">Sub-branches</h2>
                    <div className="space-y-2">
                      {branch.subBranches.map((sub: any) => (
                        <Link
                          key={sub.id}
                          href={`/branches/${sub.id}`}
                          className="flex items-center gap-3 p-3 rounded-xl hover:bg-charcoal-50 transition-colors"
                        >
                          <GitBranch className="w-4 h-4 text-gold" />
                          <span className="font-body text-navy text-sm font-medium">{sub.name}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Prayer & Fasting */}
                {(branch.prayerSchedules?.length > 0 || branch.fastingSchedules?.length > 0) && (
                  <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card p-6 lg:col-span-2">
                    <h2 className="font-heading font-bold text-navy text-xl mb-4">
                      Prayer & Fasting
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {branch.prayerSchedules?.map((ps: any) => (
                        <div key={ps.id} className="flex items-start gap-3 p-3 bg-navy/5 rounded-xl">
                          <Heart className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-body font-medium text-navy text-sm">
                              {ps.dayOfWeek !== null ? DAYS[ps.dayOfWeek] : 'Regular'} Prayer
                            </p>
                            {ps.time && <p className="font-body text-charcoal-500 text-xs">{ps.time}</p>}
                            {ps.description && <p className="font-body text-charcoal-400 text-xs mt-0.5">{ps.description}</p>}
                          </div>
                        </div>
                      ))}
                      {branch.fastingSchedules?.map((fs: any) => (
                        <div key={fs.id} className="flex items-start gap-3 p-3 bg-gold/5 border border-gold/10 rounded-xl">
                          <BookOpen className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-body font-medium text-navy text-sm">Fasting Schedule</p>
                            <p className="font-body text-charcoal-500 text-xs">{fs.pattern}</p>
                            {fs.description && <p className="font-body text-charcoal-400 text-xs mt-0.5">{fs.description}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SERVICES TAB */}
            {activeTab === 'services' && (
              <div>
                {isTemporary && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
                    <Bell className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="font-body text-amber-800 text-sm">
                      <strong>Temporary schedule active.</strong> Times have been adjusted for a special event. Check back for the return to standard times.
                    </p>
                  </div>
                )}

                <h2 className="font-heading font-bold text-navy text-xl mb-4">Service Times</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {currentTimes.map((t: any) => <ServiceTimeCard key={t.id} time={t} />)}
                </div>

                {branch.tempServiceTimes?.length > 0 && !isTemporary && (
                  <div className="mt-8">
                    <h3 className="font-heading font-semibold text-navy text-lg mb-3">Upcoming Schedule Changes</h3>
                    <div className="space-y-2">
                      {branch.tempServiceTimes.map((t: any) => (
                        <div key={t.id} className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                          <p className="font-body font-semibold text-amber-800 text-sm">
                            {new Date(t.startDate).toLocaleDateString('en-ZA')} –{' '}
                            {new Date(t.endDate).toLocaleDateString('en-ZA')}
                          </p>
                          <p className="font-body text-amber-700 text-xs mt-1">
                            {t.startTime} – {t.endTime}
                            {t.reason && ` · ${t.reason}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* LEADERSHIP TAB */}
            {activeTab === 'leadership' && (
              <div>
                <h2 className="font-heading font-bold text-navy text-xl mb-4">Branch Leadership</h2>
                {branch.leadership?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {branch.leadership.map((l: any) => <LeaderCard key={l.id} leader={l} />)}
                  </div>
                ) : (
                  <p className="text-charcoal-400 font-body text-sm">No leadership information available.</p>
                )}
              </div>
            )}

            {/* ANNOUNCEMENTS TAB */}
            {activeTab === 'announcements' && (
              <div>
                <h2 className="font-heading font-bold text-navy text-xl mb-4">Branch Notices</h2>
                {branch.announcements?.length > 0 ? (
                  <div className="space-y-3">
                    {branch.announcements.map((ann: any) => <AnnouncementItem key={ann.id} ann={ann} />)}
                  </div>
                ) : (
                  <p className="text-charcoal-400 font-body text-sm">No announcements at this time.</p>
                )}
              </div>
            )}

            {/* GALLERY TAB */}
            {activeTab === 'gallery' && (
              <div>
                <h2 className="font-heading font-bold text-navy text-xl mb-4">Gallery</h2>
                {branch.media?.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {branch.media.map((m: any) => (
                      <div key={m.id} className="aspect-square rounded-xl overflow-hidden bg-charcoal-100">
                        <img
                          src={m.mediaAsset?.url}
                          alt={m.caption || branch.name}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <Camera className="w-12 h-12 text-charcoal-200 mx-auto mb-3" />
                    <p className="text-charcoal-400 font-body text-sm">No gallery images yet.</p>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
