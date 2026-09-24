// apps/web/src/components/layout/Navigation.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, GitBranch, Globe, User, MessageSquare,
  ShoppingBag, Briefcase, Music, BookOpen, Shield,
  Menu, X, Bell, ChevronDown,
} from 'lucide-react';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { key: 'home',        href: '/',           label: 'Home',         icon: Home,         alwaysOn: true },
  { key: 'branches',    href: '/branches',   label: 'Branches',     icon: GitBranch,    alwaysOn: true },
  { key: 'regions',     href: '/regions',    label: 'Global',       icon: Globe,        alwaysOn: true },
  { key: 'sermons',     href: '/sermons',    label: 'Sermons',      icon: BookOpen,     alwaysOn: false },
  { key: 'praise_songs', href: '/songs',     label: 'Praise Songs', icon: Music,        alwaysOn: false },
  { key: 'marketplace', href: '/marketplace', label: 'Marketplace', icon: ShoppingBag,  alwaysOn: false },
  { key: 'jobs',        href: '/jobs',       label: 'Jobs',         icon: Briefcase,    alwaysOn: false },
  { key: 'messaging',   href: '/messaging',  label: 'Messages',     icon: MessageSquare, alwaysOn: false },
];

export function Navigation() {
  const pathname = usePathname();
  const { flags, isLoading } = useFeatureFlags();
  const { user, isAuthenticated } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Filter nav based on server feature flags
  const visibleNav = NAV_ITEMS.filter(
    (item) => item.alwaysOn || flags?.[item.key] === true,
  );

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-navy/95 backdrop-blur-md shadow-navy border-b border-gold/10'
          : 'bg-navy',
      )}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative h-10 w-10 overflow-hidden rounded-full border border-gold/40 bg-white shadow-gold">
              <Image
                src="/brand/logo.jpg"
                alt="First Church of Our Lord Jesus Christ logo"
                fill
                sizes="40px"
                className="object-cover"
                priority
              />
            </div>
            <div className="hidden sm:block">
              <span className="font-heading font-bold text-white text-lg leading-tight block">
                Truth of God
              </span>
              <span className="text-gold-400 text-xs font-body leading-tight block">
                First Church of Our Lord Jesus Christ
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1">
            {visibleNav.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    'nav-link flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-body transition-all duration-200',
                    isActive
                      ? 'text-gold bg-gold/10'
                      : 'text-white/80 hover:text-gold hover:bg-gold/5',
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                {/* Notifications */}
                <button className="relative p-2 text-white/70 hover:text-gold transition-colors">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-church-red rounded-full" />
                </button>

                {/* Profile dropdown */}
                <div className="relative group">
                  <button className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gold/10 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-gold/20 border border-gold/40 overflow-hidden">
                      {user?.profile?.profilePictureUrl ? (
                        <img
                          src={user.profile.profilePictureUrl}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gold text-xs font-heading font-bold">
                          {user?.profile?.firstName?.[0] || 'U'}
                        </div>
                      )}
                    </div>
                    <ChevronDown className="w-3 h-3 text-white/50" />
                  </button>

                  {/* Dropdown */}
                  <div className="absolute right-0 top-full mt-2 w-52 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 bg-navy border border-gold/20 rounded-xl shadow-navy overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/10">
                      <p className="text-white font-body font-semibold text-sm">
                        {user?.profile?.firstName} {user?.profile?.surname}
                      </p>
                      <p className="text-gold/70 text-xs mt-0.5">{user?.email}</p>
                    </div>
                    <div className="py-1">
                      <Link href="/profile" className="flex items-center gap-2 px-4 py-2 text-white/80 hover:text-gold hover:bg-gold/5 text-sm transition-colors">
                        <User className="w-4 h-4" /> My Profile
                      </Link>
                      {user?.roles?.some((r: string) => r.includes('admin')) && (
                        <Link href="/admin" className="flex items-center gap-2 px-4 py-2 text-white/80 hover:text-gold hover:bg-gold/5 text-sm transition-colors">
                          <Shield className="w-4 h-4" /> Admin Panel
                        </Link>
                      )}
                      <button className="flex items-center gap-2 w-full px-4 py-2 text-church-red/80 hover:text-church-red hover:bg-church-red/5 text-sm transition-colors">
                        Sign Out
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <Link
                href="/auth/signin"
                className="bg-gold text-navy font-body font-semibold text-sm px-4 py-2 rounded-lg hover:bg-gold-600 transition-colors shadow-gold"
              >
                Sign In
              </Link>
            )}

            {/* Mobile menu button */}
            <button
              className="lg:hidden p-2 text-white/70 hover:text-gold transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-navy-dark border-t border-gold/10 overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-4 py-4 space-y-1">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-body transition-all',
                      isActive
                        ? 'text-gold bg-gold/10'
                        : 'text-white/80 hover:text-gold hover:bg-gold/5',
                    )}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
