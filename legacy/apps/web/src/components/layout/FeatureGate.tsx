// apps/web/src/components/layout/FeatureGate.tsx
'use client';

import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { motion } from 'framer-motion';
import { Clock, Lock } from 'lucide-react';
import Link from 'next/link';

interface FeatureGateProps {
  featureKey: string;
  children: React.ReactNode;
}

export function FeatureGate({ featureKey, children }: FeatureGateProps) {
  const { isEnabled, isLoading } = useFeatureFlags();

  if (isLoading) {
    return (
      <div className="pt-16 min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isEnabled(featureKey)) {
    return <ComingSoonPage featureKey={featureKey} />;
  }

  return <>{children}</>;
}

function ComingSoonPage({ featureKey }: { featureKey: string }) {
  const labels: Record<string, string> = {
    messaging:    'Messaging',
    marketplace:  'Marketplace',
    jobs:         'Jobs Board',
    sermons:      'Sermons',
    praise_songs: 'Praise Songs',
  };

  const label = labels[featureKey] || featureKey;

  return (
    <div className="pt-16 min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full text-center"
      >
        {/* Icon */}
        <div className="w-20 h-20 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-6">
          <Clock className="w-10 h-10 text-blue-500" />
        </div>

        {/* Content */}
        <h1 className="font-heading font-bold text-navy text-3xl mb-3">
          {label} Coming Soon
        </h1>
        <p className="font-body text-charcoal-500 text-base leading-relaxed mb-8">
          This feature is not yet available on the platform. We're working on it
          and it will be released soon. Check back later.
        </p>

        {/* Status badge */}
        <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-full px-4 py-2 text-sm font-body font-medium mb-8">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          Under Development
        </div>

        {/* CTA */}
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-navy text-white font-body font-semibold px-6 py-3 rounded-xl hover:bg-navy-700 transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
