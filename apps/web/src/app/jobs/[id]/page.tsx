// apps/web/src/app/jobs/[id]/page.tsx
'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Briefcase, MapPin, Clock, DollarSign, Calendar,
  ChevronLeft, Building2, Send, CheckCircle2, Users,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from '@/hooks/useToast';

const JOB_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: 'Full Time', PART_TIME: 'Part Time', CONTRACT: 'Contract',
  INTERNSHIP: 'Internship', VOLUNTEER: 'Volunteer', FREELANCE: 'Freelance',
};

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();
  const [coverLetter, setCoverLetter] = useState('');
  const [applied, setApplied] = useState(false);

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: () => api.get(`/api/v1/jobs/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const applyMutation = useMutation({
    mutationFn: () =>
      api.post(`/api/v1/jobs/${id}/apply`, { coverLetter }).then((r) => r.data),
    onSuccess: () => {
      setApplied(true);
      toast({ title: '✓ Application submitted', description: 'The employer will be in touch via messages.' });
    },
    onError: (err: any) => {
      toast({ title: '✗ Error', description: err?.response?.data?.message || 'Application failed' });
    },
  });

  if (isLoading) return (
    <div className="pt-16 min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!job) return (
    <div className="pt-16 min-h-screen flex items-center justify-center">
      <p className="font-body text-charcoal-400">Job not found.</p>
    </div>
  );

  const isPast = job.deadline && new Date(job.deadline) < new Date();

  return (
    <div className="pt-16 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-navy-gradient py-12 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 church-pattern opacity-10" />
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gold-gradient" />
        <div className="max-w-4xl mx-auto relative z-10">
          <Link href="/jobs" className="inline-flex items-center gap-2 text-white/60 hover:text-gold text-sm font-body mb-4 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Back to Jobs
          </Link>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-7 h-7 text-white/50" />
              </div>
              <div>
                <h1 className="font-heading font-bold text-white text-3xl sm:text-4xl mb-1">{job.title}</h1>
                {job.company && <p className="font-body text-white/70 text-lg mb-2">{job.company}</p>}
                <div className="flex flex-wrap gap-3 text-white/50 text-sm font-body">
                  {job.locationText && <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-gold" />{job.locationText}</span>}
                  <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" />{JOB_TYPE_LABELS[job.type] || job.type}</span>
                  {job.salary && <span className="flex items-center gap-1.5"><DollarSign className="w-4 h-4" />{job.salary}</span>}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card p-6">
              <h2 className="font-heading font-bold text-navy text-xl mb-4">Job Description</h2>
              <div className="font-body text-charcoal-600 text-sm leading-relaxed whitespace-pre-line">
                {job.description}
              </div>
            </div>

            {/* Application form */}
            {isAuthenticated && !isPast && (
              <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card p-6">
                <h2 className="font-heading font-bold text-navy text-xl mb-4">Apply for this Position</h2>

                {applied ? (
                  <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                    <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="font-body font-semibold text-green-800 text-sm">Application submitted!</p>
                      <p className="font-body text-green-700 text-xs mt-0.5">
                        Check your messages for updates from the employer.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-body font-medium text-charcoal-500 mb-1.5 uppercase tracking-wide">
                        Cover Letter (optional)
                      </label>
                      <textarea
                        value={coverLetter}
                        onChange={(e) => setCoverLetter(e.target.value)}
                        rows={5}
                        placeholder="Briefly introduce yourself and explain why you're a great fit..."
                        className="w-full px-4 py-3 border border-charcoal-200 rounded-xl text-sm font-body focus:outline-none focus:ring-2 focus:ring-gold/30 resize-none"
                      />
                    </div>
                    <button
                      onClick={() => applyMutation.mutate()}
                      disabled={applyMutation.isPending}
                      className="flex items-center gap-2 bg-navy text-white font-body font-semibold text-sm px-6 py-3 rounded-xl hover:bg-navy-700 transition-colors disabled:opacity-50 shadow-navy"
                    >
                      <Send className="w-4 h-4" />
                      {applyMutation.isPending ? 'Submitting...' : 'Submit Application'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {!isAuthenticated && (
              <div className="bg-navy/5 border border-navy/10 rounded-2xl p-5 text-center">
                <p className="font-body text-charcoal-500 text-sm mb-3">
                  Sign in and verify your account to apply for this position.
                </p>
                <Link href="/auth/signin" className="inline-flex items-center gap-2 bg-navy text-white font-body text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-navy-700 transition-colors">
                  Sign In to Apply
                </Link>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Job details card */}
            <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card p-5">
              <h3 className="font-heading font-bold text-navy text-lg mb-4">Details</h3>
              <div className="space-y-3 text-sm font-body">
                <div className="flex items-start gap-2.5">
                  <Briefcase className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-charcoal-400 text-xs">Type</p>
                    <p className="text-navy font-medium">{JOB_TYPE_LABELS[job.type] || job.type}</p>
                  </div>
                </div>
                {job.salary && (
                  <div className="flex items-start gap-2.5">
                    <DollarSign className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-charcoal-400 text-xs">Salary</p>
                      <p className="text-navy font-medium">{job.salary}</p>
                    </div>
                  </div>
                )}
                {job.deadline && (
                  <div className="flex items-start gap-2.5">
                    <Calendar className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-charcoal-400 text-xs">Deadline</p>
                      <p className={cn('font-medium', isPast ? 'text-church-red' : 'text-navy')}>
                        {format(new Date(job.deadline), 'dd MMMM yyyy')}
                        {!isPast && <span className="text-charcoal-400 font-normal text-xs ml-1">
                          ({formatDistanceToNow(new Date(job.deadline), { addSuffix: true })})
                        </span>}
                        {isPast && <span className="text-church-red text-xs ml-1">(Closed)</span>}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2.5">
                  <Users className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-charcoal-400 text-xs">Applications</p>
                    <p className="text-navy font-medium">{job._count?.applications || 0}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Posted by */}
            {job.poster?.profile && (
              <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card p-5">
                <h3 className="font-body font-semibold text-charcoal-400 text-xs uppercase tracking-wider mb-3">
                  Posted By
                </h3>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-navy/10 flex items-center justify-center">
                    <span className="font-bold text-navy text-sm">
                      {job.poster.profile.firstName?.[0]}
                    </span>
                  </div>
                  <p className="font-body font-semibold text-navy text-sm">
                    {job.poster.profile.firstName} {job.poster.profile.surname}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
