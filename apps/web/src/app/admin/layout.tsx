// apps/web/src/app/admin/layout.tsx
'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Users, GitBranch, Globe, Shield,
  ShoppingBag, Briefcase, Music, BookOpen, MessageSquare,
  ToggleLeft, Activity, Mail, Settings, ChevronRight,
  Bell, Database, FileText, BarChart3, Menu, X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const SIDEBAR_ITEMS = [
  { section: 'Dashboard' },
  { key: '/admin',             label: 'Overview',        icon: LayoutDashboard, exact: true },
  { key: '/admin/features',    label: 'Feature Flags',   icon: ToggleLeft },
  { key: '/admin/analytics',   label: 'Analytics',       icon: BarChart3 },

  { section: 'People' },
  { key: '/admin/users',       label: 'Members',         icon: Users },
  { key: '/admin/verification', label: 'Verification Queue', icon: Shield },
  { key: '/admin/moderation',  label: 'Moderation',      icon: Shield },

  { section: 'Content' },
  { key: '/admin/branches',    label: 'Branches',        icon: GitBranch },
  { key: '/admin/geo',         label: 'Geo / Regions',   icon: Globe },
  { key: '/admin/announcements', label: 'Announcements', icon: Bell },

  { section: 'Marketplace & Jobs' },
  { key: '/admin/marketplace', label: 'Marketplace',     icon: ShoppingBag },
  { key: '/admin/jobs',        label: 'Jobs',            icon: Briefcase },

  { section: 'Media' },
  { key: '/admin/sermons',     label: 'Sermons',         icon: BookOpen },
  { key: '/admin/songs',       label: 'Praise Songs',    icon: Music },
  { key: '/admin/media',       label: 'Media Assets',    icon: FileText },

  { section: 'System' },
  { key: '/admin/emails',      label: 'Email Templates', icon: Mail },
  { key: '/admin/audit',       label: 'Audit Logs',      icon: Activity },
  { key: '/admin/backups',     label: 'Backups',         icon: Database },
  { key: '/admin/settings',    label: 'Settings',        icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isAdmin } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Redirect non-admins (also handled server-side by role guard)
  if (user && !isAdmin()) {
    return (
      <div className="pt-16 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-charcoal-200 mx-auto mb-4" />
          <h2 className="font-heading text-2xl text-navy mb-2">Access Denied</h2>
          <p className="text-charcoal-400 font-body">You don't have permission to access the admin panel.</p>
        </div>
      </div>
    );
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-charcoal-50">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-navy flex items-center justify-center">
            <Shield className="w-4 h-4 text-gold" />
          </div>
          <div>
            <p className="font-heading font-bold text-navy text-sm leading-tight">Admin Panel</p>
            <p className="text-[11px] text-charcoal-400 font-body leading-tight">
              {user?.profile?.firstName} {user?.profile?.surname}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {SIDEBAR_ITEMS.map((item, i) => {
          if ('section' in item && !item.key) {
            return (
              <p key={i} className="text-[10px] font-body font-semibold text-charcoal-400 uppercase tracking-widest px-3 pt-4 pb-1.5">
                {item.section}
              </p>
            );
          }

          if (!item.key || !item.icon) return null;
          const Icon = item.icon;
          const isActive = item.exact
            ? pathname === item.key
            : pathname.startsWith(item.key);

          return (
            <Link
              key={item.key}
              href={item.key}
              onClick={() => setMobileSidebarOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-body text-left transition-all mb-0.5',
                isActive
                  ? 'bg-navy text-white font-semibold'
                  : 'text-charcoal-600 hover:bg-charcoal-50 hover:text-navy',
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {isActive && <ChevronRight className="w-3 h-3 opacity-40 flex-shrink-0" />}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-charcoal-50">
        <Link href="/" className="text-xs text-charcoal-400 font-body hover:text-navy transition-colors">
          ← Back to Platform
        </Link>
      </div>
    </div>
  );

  return (
    <div className="pt-16 min-h-screen bg-gray-50 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-white border-r border-charcoal-100 shadow-sm fixed top-16 bottom-0 z-20">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileSidebarOpen(false)} />
          <motion.div
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-2xl z-50"
          >
            <SidebarContent />
          </motion.div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-60 flex flex-col min-h-0">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-charcoal-100 sticky top-16 z-30">
          <button onClick={() => setMobileSidebarOpen(true)} className="p-1.5 text-charcoal-500">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-body font-semibold text-navy text-sm">Admin Panel</span>
        </div>

        <div className="flex-1 p-6 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
