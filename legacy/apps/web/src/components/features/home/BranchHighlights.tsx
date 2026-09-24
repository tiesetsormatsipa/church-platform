// apps/web/src/components/features/home/BranchHighlights.tsx
'use client';

import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Users, Clock, ChevronRight, Building2 } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function BranchHighlights() {
  const { data } = useQuery({
    queryKey: ['branches-highlights'],
    queryFn: () =>
      api.get('/api/v1/branches', { params: { type: 'MAIN', limit: 4 } }).then((r) => r.data),
  });

  const branches = data?.data || [];
  if (!branches.length) return null;

  return (
    <section className="py-20 px-4 sm:px-6 bg-cream">
      <div className="max-w-6xl mx-auto">
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
                Our Locations
              </span>
            </div>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-navy">
              Find a Branch
            </h2>
          </div>
          <Link
            href="/branches"
            className="sm:ml-auto flex items-center gap-1 text-sm text-gold-700 font-body font-medium hover:text-gold transition-colors"
          >
            View all branches <ChevronRight className="w-4 h-4" />
          </Link>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {branches.map((branch: any, i: number) => (
            <motion.div
              key={branch.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
            >
              <Link href={`/branches/${branch.id}`}>
                <div className="group bg-white rounded-2xl border border-charcoal-100 shadow-card hover:shadow-gold hover:border-gold/30 transition-all duration-300 hover:-translate-y-1 overflow-hidden">
                  {/* Image */}
                  <div className="h-36 relative overflow-hidden bg-navy/5">
                    {branch.heroImageUrl ? (
                      <img
                        src={branch.heroImageUrl}
                        alt={branch.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-navy-gradient">
                        <Building2 className="w-10 h-10 text-gold/20" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-heading font-bold text-navy text-base leading-snug mb-1.5 group-hover:text-gold transition-colors">
                      {branch.name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-charcoal-400 text-xs font-body mb-2">
                      <MapPin className="w-3 h-3 text-gold flex-shrink-0" />
                      {[branch.city?.name, branch.country?.name].filter(Boolean).join(', ')}
                    </div>
                    {branch.serviceTimes?.[0] && (
                      <div className="flex items-center gap-1.5 text-charcoal-400 text-xs font-body">
                        <Clock className="w-3 h-3 flex-shrink-0" />
                        {DAYS[branch.serviceTimes[0].dayOfWeek]} {branch.serviceTimes[0].startTime}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
