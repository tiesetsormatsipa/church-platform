// apps/web/src/app/jobs/page.tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Search, Briefcase, MapPin, Clock, DollarSign,
  Calendar, ChevronRight, Building2, Filter, X,
} from 'lucide-react';
import Link from 'next/link';
import { FeatureGate } from '@/components/layout/FeatureGate';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

const JOB_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'VOLUNTEER', 'FREELANCE'];
const JOB_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: 'Full Time', PART_TIME: 'Part Time', CONTRACT: 'Contract',
  INTERNSHIP: 'Internship', VOLUNTEER: 'Volunteer', FREELANCE: 'Freelance',
};

function JobCard({ job, index }: { job: any; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35 }}
    >
      <Link href={`/jobs/${job.id}`}>
        <div className="group bg-white rounded-2xl border border-charcoal-100 shadow-card p-5 hover:shadow-gold hover:border-gold/30 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-start gap-4">
            {/* Company logo / placeholder */}
            <div className="w-12 h-12 rounded-xl bg-navy/5 border border-navy/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-6 h-6 text-navy/30" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="font-heading font-bold text-navy text-lg leading-snug group-hover:text-gold transition-colors">
                  {job.title}
                </h3>
                <ChevronRight className="w-5 h-5 text-gold opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
              </div>

              {job.company && (
                <p className="font-body text-charcoal-500 text-sm mb-2">{job.company}</p>
              )}

              <div className="flex flex-wrap gap-3 text-xs text-charcoal-400 font-body mb-3">
                {job.locationText && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {job.locationText}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {JOB_TYPE_LABELS[job.type] || job.type}
                </span>
                {job.salary && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" /> {job.salary}
                  </span>
                )}
                {job.deadline && (
                  <span className="flex items-center gap-1 text-church-red/70">
                    <Calendar className="w-3.5 h-3.5" />
                    Closes {formatDistanceToNow(new Date(job.deadline), { addSuffix: true })}
                  </span>
                )}
              </div>

              {job.description && (
                <p className="font-body text-charcoal-500 text-sm line-clamp-2">{job.description}</p>
              )}

              <div className="mt-3 flex items-center gap-2">
                <span className={cn(
                  'text-xs font-body font-medium px-2.5 py-1 rounded-full',
                  'bg-navy/5 text-navy border border-navy/10',
                )}>
                  {JOB_TYPE_LABELS[job.type] || job.type}
                </span>
                {job.category && (
                  <span className="text-xs font-body text-charcoal-400 bg-charcoal-50 rounded-full px-2.5 py-1">
                    {job.category}
                  </span>
                )}
                <span className="ml-auto text-xs text-charcoal-400 font-body">
                  {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function JobsPage() {
  return (
    <FeatureGate featureKey="jobs">
      <JobsContent />
    </FeatureGate>
  );
}

function JobsContent() {
  const [search, setSearch]     = useState('');
  const [typeFilter, setType]   = useState('all');
  const [page, setPage]         = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['jobs', search, typeFilter, page],
    queryFn: () =>
      api.get('/api/v1/jobs', {
        params: {
          search: search || undefined,
          type: typeFilter !== 'all' ? typeFilter : undefined,
          status: 'PUBLISHED',
          page,
          limit: 12,
        },
      }).then((r) => r.data),
  });

  const jobs = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="pt-16 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-navy-gradient py-14 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 church-pattern opacity-10" />
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gold-gradient" />
        <div className="max-w-5xl mx-auto relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-0.5 bg-gold" />
              <span className="text-gold text-sm font-body uppercase tracking-wider">Opportunities</span>
            </div>
            <h1 className="font-heading font-bold text-white text-5xl mb-3">Jobs Board</h1>
            <p className="text-white/60 font-body text-lg">
              Career opportunities from verified church members and businesses.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-charcoal-100 sticky top-16 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
            <input
              type="text"
              placeholder="Job title, company, or keyword..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2.5 border border-charcoal-200 rounded-lg text-sm font-body focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setType('all')}
              className={cn(
                'px-3 py-2 rounded-lg text-xs font-body font-medium transition-all',
                typeFilter === 'all' ? 'bg-navy text-white' : 'bg-charcoal-50 text-charcoal-600 hover:bg-charcoal-100',
              )}
            >
              All Types
            </button>
            {JOB_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => { setType(t); setPage(1); }}
                className={cn(
                  'px-3 py-2 rounded-lg text-xs font-body font-medium transition-all',
                  typeFilter === t ? 'bg-navy text-white' : 'bg-charcoal-50 text-charcoal-600 hover:bg-charcoal-100',
                )}
              >
                {JOB_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Jobs list */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-36 skeleton rounded-2xl" />)
          : jobs.length === 0
          ? (
            <div className="text-center py-20">
              <Briefcase className="w-12 h-12 text-charcoal-200 mx-auto mb-3" />
              <p className="font-body text-charcoal-400">No job posts found.</p>
            </div>
          )
          : jobs.map((job: any, i: number) => <JobCard key={job.id} job={job} index={i} />)
        }

        {meta && meta.totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
              className="px-4 py-2 border border-charcoal-200 rounded-lg text-sm font-body disabled:opacity-40 hover:border-gold/40 transition-colors">
              Previous
            </button>
            <span className="px-4 py-2 text-sm font-body text-charcoal-500">
              {page} / {meta.totalPages}
            </span>
            <button disabled={page === meta.totalPages} onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 border border-charcoal-200 rounded-lg text-sm font-body disabled:opacity-40 hover:border-gold/40 transition-colors">
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
