// apps/web/src/app/page.tsx
'use client';

import { motion } from 'framer-motion';
import { HeroSection } from '@/components/features/home/HeroSection';
import { EventCountdown } from '@/components/features/home/EventCountdown';
import { AnnouncementsFeed } from '@/components/features/home/AnnouncementsFeed';
import { BranchHighlights } from '@/components/features/home/BranchHighlights';
import { QuickLinks } from '@/components/features/home/QuickLinks';

export default function HomePage() {
  return (
    <div className="pt-16">
      <HeroSection />
      <EventCountdown />
      <AnnouncementsFeed />
      <BranchHighlights />
      <QuickLinks />
    </div>
  );
}
