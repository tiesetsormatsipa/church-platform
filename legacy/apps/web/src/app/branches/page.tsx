// apps/web/src/app/branches/page.tsx
'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Search, MapPin, Users, Clock, ChevronRight,
  GitBranch, Globe, Filter, X, Building2,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

function ServiceTimePill({ time }: { time: any }) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-navy/5 text-navy border border-navy/10 rounded-full px-2.5 py-1 font-body">
      <Clock className="w-3 h-3" />
      {days[time.dayOfWeek]} {time.startTime}
    </span>
  );
}

function BranchCard({ branch, index }: { branch: any; index: number }) {
  const isMain = branch.type === 'MAIN';

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.4 }}
      className="group"
    >
      <Link href={`/branches/${branch.id}`}>
        <div
          className={cn(
            'relative bg-white rounded-2xl border border-charcoal-100 shadow-card',
            'hover:shadow-gold hover:border-gold/30 transition-all duration-300',
            'hover:-translate-y-1 overflow-hidden',
          )}
        >
          {/* Branch image / placeholder */}
          <div className="relative h-44 overflow-hidden bg-navy/5">
            {branch.heroImageUrl ? (
              <img
                src={branch.heroImageUrl}
                alt={branch.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-navy-gradient">
                <Building2 className="w-12 h-12 text-gold/40" />
              </div>
            )}

            {/* Type badge */}
            <div className="absolute top-3 left-3">
              <span
                className={cn(
                  'text-xs font-body font-semibold px-3 py-1 rounded-full',
                  isMain
                    ? 'bg-gold text-navy'
                    : 'bg-white/90 text-charcoal-600 border border-charcoal-200',
                )}
              >
                {isMain ? 'Main Branch' : 'Sub-branch'}
              </span>
            </div>

            {/* Sub-branches count */}
            {branch.subBranches?.length > 0 && (
              <div className="absolute top-3 right-3 bg-navy/80 backdrop-blur-sm text-white text-xs rounded-full px-2.5 py-1 flex items-center gap-1">
                <GitBranch className="w-3 h-3" />
                {branch.subBranches.length}
              </div>
            )}
          </div>

          {/* Card content */}
          <div className="p-5">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-heading font-bold text-navy text-xl leading-snug">
                {branch.name}
              </h3>
              <ChevronRight className="w-5 h-5 text-gold opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
            </div>

            {/* Location */}
            <div className="flex items-center gap-1.5 text-charcoal-500 text-sm font-body mb-3">
              <MapPin className="w-4 h-4 text-gold flex-shrink-0" />
              <span>
                {[branch.city?.name, branch.province?.name, branch.country?.name]
                  .filter(Boolean)
                  .join(', ')}
              </span>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-4 mb-4 text-sm font-body text-charcoal-500">
              {branch.estimatedMembers && (
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-gold" />
                  ~{branch.estimatedMembers.toLocaleString()}
                </span>
              )}
              {branch._count?.profiles > 0 && (
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-navy/50" />
                  {branch._count.profiles} members
                </span>
              )}
            </div>

            {/* Service times */}
            {branch.serviceTimes?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {branch.serviceTimes.slice(0, 3).map((t: any) => (
                  <ServiceTimePill key={t.id} time={t} />
                ))}
                {branch.serviceTimes.length > 3 && (
                  <span className="text-xs text-charcoal-400 font-body self-center">
                    +{branch.serviceTimes.length - 3} more
                  </span>
                )}
              </div>
            )}

            {/* Leadership preview */}
            {branch.leadership?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-charcoal-50">
                <p className="text-xs text-charcoal-400 font-body mb-1">Leadership</p>
                <p className="text-sm font-body text-navy font-medium">
                  {branch.leadership[0]?.position}: {branch.leadership[0]?.name}
                </p>
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function BranchesPage() {
  const [search, setSearch]           = useState('');
  const [typeFilter, setTypeFilter]   = useState('all');
  const [countryFilter, setCountry]   = useState('all');
  const [page, setPage]               = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['branches', search, typeFilter, countryFilter, page],
    queryFn: () =>
      api.get('/api/v1/branches', {
        params: {
          search: search || undefined,
          type: typeFilter !== 'all' ? typeFilter : undefined,
          countryId: countryFilter !== 'all' ? countryFilter : undefined,
          page,
          limit: 12,
        },
      }).then((r) => r.data),
  });

  const { data: countries } = useQuery({
    queryKey: ['countries'],
    queryFn: () => api.get('/api/v1/geo/countries').then((r) => r.data),
  });

  const branches = data?.data || [];
  const meta     = data?.meta;

  return (
    <div className="pt-16 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-navy-gradient py-16 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 church-pattern opacity-10" />
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gold-gradient" />
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-0.5 bg-gold" />
              <span className="text-gold text-sm font-body uppercase tracking-wider">
                Our Locations
              </span>
            </div>
            <h1 className="font-heading font-bold text-white text-5xl sm:text-6xl mb-3">
              Branches
            </h1>
            <p className="text-white/60 font-body text-lg max-w-xl">
              Find a church community near you. We are present across South Africa
              and expanding globally.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-white border-b border-charcoal-100 sticky top-16 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
              <input
                type="text"
                placeholder="Search branches, cities..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-4 py-2.5 border border-charcoal-200 rounded-lg text-sm font-body focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold/50 transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400 hover:text-charcoal-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex gap-2 flex-wrap">
              {/* Type filter */}
              <select
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                className="px-3 py-2.5 border border-charcoal-200 rounded-lg text-sm font-body focus:outline-none focus:ring-2 focus:ring-gold/30 bg-white text-charcoal-700"
              >
                <option value="all">All Types</option>
                <option value="MAIN">Main Branches</option>
                <option value="SUB">Sub-branches</option>
              </select>

              {/* Country filter */}
              <select
                value={countryFilter}
                onChange={(e) => { setCountry(e.target.value); setPage(1); }}
                className="px-3 py-2.5 border border-charcoal-200 rounded-lg text-sm font-body focus:outline-none focus:ring-2 focus:ring-gold/30 bg-white text-charcoal-700"
              >
                <option value="all">All Countries</option>
                {countries?.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Active filter chips + result count */}
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-charcoal-400 font-body">
              {meta?.total ?? 0} branch{meta?.total !== 1 ? 'es' : ''} found
            </span>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-72 skeleton rounded-2xl" />
            ))}
          </div>
        ) : branches.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-24"
          >
            <Building2 className="w-16 h-16 text-charcoal-200 mx-auto mb-4" />
            <h3 className="font-heading text-xl text-charcoal-500 mb-2">No branches found</h3>
            <p className="font-body text-charcoal-400 text-sm">
              Try adjusting your filters or search terms.
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {branches.map((branch: any, i: number) => (
              <BranchCard key={branch.id} branch={branch} index={i} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-12">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-4 py-2 border border-charcoal-200 rounded-lg text-sm font-body disabled:opacity-40 hover:border-gold/40 transition-colors"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-sm font-body text-charcoal-500">
              Page {page} of {meta.totalPages}
            </span>
            <button
              disabled={page === meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 border border-charcoal-200 rounded-lg text-sm font-body disabled:opacity-40 hover:border-gold/40 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
