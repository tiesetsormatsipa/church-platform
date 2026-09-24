// apps/web/src/components/features/home/AnnouncementsFeed.tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Pin, AlertTriangle, Info, Calendar, ChevronRight, Filter } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { value: 'all',          label: 'All',             color: 'text-charcoal-500' },
  { value: 'general',      label: 'General',         color: 'text-navy' },
  { value: 'baptism',      label: 'Baptisms',        color: 'text-blue-600' },
  { value: 'event',        label: 'Events',          color: 'text-gold-700' },
  { value: 'important',    label: 'Important',       color: 'text-church-red' },
  { value: 'changes',      label: 'Info Changes',    color: 'text-purple-600' },
];

function AnnouncementCard({ item, index }: { item: any; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const categoryColors: Record<string, string> = {
    important: 'border-l-church-red',
    baptism:   'border-l-blue-500',
    event:     'border-l-gold',
    general:   'border-l-navy',
    changes:   'border-l-purple-500',
  };

  const categoryBg: Record<string, string> = {
    important: 'bg-red-50',
    baptism:   'bg-blue-50',
    event:     'bg-gold/5',
    general:   'bg-white',
    changes:   'bg-purple-50',
  };

  const borderColor = categoryColors[item.category] || 'border-l-charcoal-200';
  const bgColor     = categoryBg[item.category] || 'bg-white';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4 }}
      className={cn(
        'rounded-xl border border-charcoal-100 border-l-4 shadow-card',
        'hover:shadow-md transition-shadow duration-200',
        borderColor, bgColor,
      )}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {item.isPinned && (
                <span className="inline-flex items-center gap-1 text-xs bg-gold/10 text-gold-700 border border-gold/20 rounded-full px-2 py-0.5 font-body font-medium">
                  <Pin className="w-3 h-3" /> Pinned
                </span>
              )}
              {item.category && (
                <span className="inline-flex items-center text-xs bg-charcoal-100 text-charcoal-600 rounded-full px-2 py-0.5 font-body capitalize">
                  {item.category}
                </span>
              )}
              <span className="text-xs text-charcoal-400 font-body ml-auto">
                {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
              </span>
            </div>

            <h3 className="font-heading font-semibold text-navy text-lg leading-snug mb-2">
              {item.title}
            </h3>

            <div
              className={cn(
                'font-body text-charcoal-600 text-sm leading-relaxed overflow-hidden transition-all duration-300',
                expanded ? 'max-h-[1000px]' : 'max-h-16',
              )}
            >
              {item.content}
            </div>

            {item.content?.length > 120 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-2 text-xs text-gold-700 font-body font-medium hover:text-gold transition-colors flex items-center gap-1"
              >
                {expanded ? 'Show less' : 'Read more'}
                <ChevronRight className={cn('w-3 h-3 transition-transform', expanded && 'rotate-90')} />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function AnnouncementsFeed() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['announcements', activeCategory, branchFilter],
    queryFn: () =>
      api
        .get('/api/v1/announcements', {
          params: {
            category: activeCategory !== 'all' ? activeCategory : undefined,
            branchId: branchFilter !== 'all' ? branchFilter : undefined,
            status: 'PUBLISHED',
            limit: 12,
          },
        })
        .then((r) => r.data),
  });

  const announcements = data?.data || [];

  return (
    <section id="content-start" className="bg-white py-20 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col sm:flex-row sm:items-end gap-4 mb-10"
        >
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-0.5 bg-gold" />
              <span className="text-gold-700 text-sm font-body font-medium uppercase tracking-wider">
                Latest Updates
              </span>
            </div>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-navy">
              Church Announcements
            </h2>
          </div>
          <a
            href="/announcements"
            className="sm:ml-auto flex items-center gap-1 text-sm text-gold-700 font-body font-medium hover:text-gold transition-colors"
          >
            View all <ChevronRight className="w-4 h-4" />
          </a>
        </motion.div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-body font-medium transition-all duration-200',
                activeCategory === cat.value
                  ? 'bg-navy text-white shadow-sm'
                  : 'bg-charcoal-50 text-charcoal-600 hover:bg-charcoal-100',
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Announcements list */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 skeleton rounded-xl" />
            ))}
          </div>
        ) : announcements.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <Info className="w-12 h-12 text-charcoal-200 mx-auto mb-3" />
            <p className="font-body text-charcoal-400">No announcements at this time.</p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {announcements.map((item: any, i: number) => (
                <AnnouncementCard key={item.id} item={item} index={i} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </section>
  );
}
