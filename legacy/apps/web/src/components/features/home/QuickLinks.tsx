'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Globe, BookOpen, Music, ShoppingBag, Briefcase, MessageSquare, User } from 'lucide-react';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

const LINKS = [
  { key: 'regions', href: '/regions', label: 'Global Map', icon: Globe, alwaysOn: true },
  { key: 'sermons', href: '/sermons', label: 'Sermons', icon: BookOpen, alwaysOn: false },
  { key: 'praise_songs', href: '/songs', label: 'Praise Songs', icon: Music, alwaysOn: false },
  { key: 'marketplace', href: '/marketplace', label: 'Marketplace', icon: ShoppingBag, alwaysOn: false },
  { key: 'jobs', href: '/jobs', label: 'Jobs Board', icon: Briefcase, alwaysOn: false },
  { key: 'messaging', href: '/messaging', label: 'Messages', icon: MessageSquare, alwaysOn: false },
  { key: 'profile', href: '/profile', label: 'My Profile', icon: User, alwaysOn: true },
];

export function QuickLinks() {
  const { isEnabled } = useFeatureFlags();
  const visibleLinks = LINKS.filter((link) => link.alwaysOn || isEnabled(link.key));

  return (
    <section className="relative overflow-hidden bg-navy-gradient px-4 py-16 sm:px-6">
      <div className="absolute inset-0 church-pattern opacity-10" />
      <div className="absolute left-0 right-0 top-0 h-0.5 bg-gold-gradient" />

      <div className="relative z-10 mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-10 text-center"
        >
          <h2 className="mb-3 font-heading text-3xl font-bold text-white sm:text-4xl">
            Explore the Platform
          </h2>
          <p className="font-body text-base text-white/60">
            Branches, sermons, announcements, and member tools in one place.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visibleLinks.map(({ key, href, label, icon: Icon }, index) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.06 }}
            >
              <Link href={href}>
                <div className="group flex min-h-32 flex-col items-center justify-center gap-3 rounded-lg border border-white/10 bg-white/5 p-5 text-center transition-all duration-200 hover:border-gold/30 hover:bg-gold/10">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gold/10 transition-colors group-hover:bg-gold/20">
                    <Icon className="h-6 w-6 text-gold" />
                  </div>
                  <span className="font-body text-sm font-semibold text-white transition-colors group-hover:text-gold">
                    {label}
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
