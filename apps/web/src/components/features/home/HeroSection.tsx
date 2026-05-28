// apps/web/src/components/features/home/HeroSection.tsx
'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { MapPin, Calendar, ChevronDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function HeroSection() {
  const { data: brandSettings } = useQuery({
    queryKey: ['brand-settings'],
    queryFn: () => api.get('/api/v1/admin/brand-settings').then((r) => r.data),
  });

  const heroImage = brandSettings?.heroImageUrl || '/images/hero-placeholder.jpg';
  const eventPoster = brandSettings?.eventPosterUrl;

  const scrollToContent = () => {
    document.getElementById('content-start')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-[92vh] flex flex-col overflow-hidden">
      {/* Background image with overlay */}
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-navy/80 via-navy/60 to-navy/90" />
        {/* Church pattern */}
        <div className="absolute inset-0 church-pattern opacity-20" />
        {/* Gold accent lines */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gold-gradient" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="max-w-4xl mx-auto"
        >
          {/* Pre-title badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-gold/10 border border-gold/30 rounded-full px-4 py-1.5 mb-6"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
            <span className="text-gold text-sm font-body font-medium tracking-wider uppercase">
              Welcome to Our Community
            </span>
          </motion.div>

          {/* Main heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7 }}
            className="font-heading font-bold text-white text-5xl sm:text-6xl lg:text-7xl leading-tight mb-6"
          >
            Built on{' '}
            <span className="gold-text">Faith,</span>
            <br />
            Rooted in{' '}
            <span className="gold-text">Truth.</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.7 }}
            className="font-body text-white/75 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            A community of believers growing together across South Africa and beyond.
            Join us for worship, fellowship, and the Word.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.7 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              href="/branches"
              className="inline-flex items-center gap-2 bg-gold text-navy font-body font-semibold px-8 py-4 rounded-xl hover:bg-gold-600 transition-all duration-200 shadow-gold hover:shadow-gold-lg hover:-translate-y-0.5"
            >
              <MapPin className="w-5 h-5" />
              Find a Branch
            </Link>
            <a
              href="#event-countdown"
              className="inline-flex items-center gap-2 bg-white/10 text-white border border-white/20 font-body font-semibold px-8 py-4 rounded-xl hover:bg-white/15 hover:border-gold/40 transition-all duration-200 backdrop-blur-sm"
            >
              <Calendar className="w-5 h-5" />
              Upcoming Event
            </a>
          </motion.div>
        </motion.div>

        {/* Event Poster — shown if configured */}
        {eventPoster && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="mt-12 max-w-sm mx-auto"
          >
            <img
              src={eventPoster}
              alt="Upcoming Event"
              className="rounded-2xl shadow-2xl border border-gold/20"
            />
          </motion.div>
        )}
      </div>

      {/* Scroll indicator */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
        onClick={scrollToContent}
        className="relative z-10 mx-auto mb-8 flex flex-col items-center gap-2 text-white/50 hover:text-gold transition-colors"
        aria-label="Scroll down"
      >
        <span className="text-xs font-body tracking-widest uppercase">Explore</span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          <ChevronDown className="w-5 h-5" />
        </motion.div>
      </motion.button>

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M0 60L480 20L960 40L1440 0V60H0Z"
            fill="#FAFAF8"
          />
        </svg>
      </div>
    </section>
  );
}
