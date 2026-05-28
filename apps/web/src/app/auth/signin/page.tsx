// apps/web/src/app/auth/signin/page.tsx
'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { Chrome, Shield, ArrowRight, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';

export default function SignInPage() {
  const [showEmail, setShowEmail] = useState(false);

  const handleGoogleSignIn = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/google`;
  };

  return (
    <div className="min-h-screen bg-navy-gradient flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 church-pattern opacity-10" />
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gold-gradient" />

      {/* Decorative gold orbs */}
      <div className="absolute top-20 right-20 w-64 h-64 bg-gold/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 left-20 w-48 h-48 bg-gold/5 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gold-gradient flex items-center justify-center mx-auto mb-4 shadow-gold-lg">
            <span className="text-navy font-heading font-bold text-2xl">✝</span>
          </div>
          <h1 className="font-heading font-bold text-white text-3xl mb-2">
            Welcome Back
          </h1>
          <p className="font-body text-white/50 text-sm">
            Sign in to access your church community
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-2xl">

          {/* Google sign in — primary */}
          <button
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 bg-white text-charcoal-800 font-body font-semibold py-3.5 rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5 mb-4"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-transparent px-3 text-xs text-white/30 font-body">
                or sign in with email
              </span>
            </div>
          </div>

          {/* Email form (minimal) */}
          <button
            onClick={() => setShowEmail(!showEmail)}
            className="w-full flex items-center justify-center gap-2 border border-white/15 text-white/70 font-body text-sm py-3 rounded-xl hover:border-white/25 hover:text-white transition-all mb-6"
          >
            Email / Password
            <ArrowRight className="w-4 h-4" />
          </button>

          {showEmail && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-3 mb-6"
            >
              <input
                type="email"
                placeholder="your@email.com"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm font-body placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-gold/40"
              />
              <input
                type="password"
                placeholder="Password"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm font-body placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-gold/40"
              />
              <button className="w-full bg-gold text-navy font-body font-semibold py-3 rounded-xl hover:bg-gold-600 transition-colors shadow-gold">
                Sign In
              </button>
            </motion.div>
          )}

          {/* Trust note */}
          <div className="flex items-start gap-2.5 p-3 bg-white/5 border border-white/10 rounded-xl">
            <Shield className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
            <p className="text-white/50 text-xs font-body leading-relaxed">
              New accounts receive limited access. Complete your profile and submit
              for verification to access all platform features.
            </p>
          </div>
        </div>

        <p className="text-center text-white/30 text-xs font-body mt-6">
          By signing in, you agree to our{' '}
          <Link href="/terms" className="text-gold/60 hover:text-gold transition-colors">Terms</Link>
          {' and '}
          <Link href="/privacy" className="text-gold/60 hover:text-gold transition-colors">Privacy Policy</Link>
        </p>
      </motion.div>
    </div>
  );
}
