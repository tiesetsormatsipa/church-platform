// apps/web/src/app/admin/page.tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard, Users, GitBranch, Globe, ToggleLeft,
  ShoppingBag, Briefcase, Music, BookOpen, MessageSquare,
  Shield, Activity, AlertTriangle, CheckCircle2, Clock,
  TrendingUp, Mail, FileText, Settings, ChevronRight,
  Eye, EyeOff, BarChart3, Database, Bell,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/useToast';

// ---- Stat Card ----
function StatCard({ icon: Icon, label, value, sub, color = 'gold', trend }: any) {
  const colorMap: Record<string, string> = {
    gold:  'text-gold bg-gold/10',
    navy:  'text-navy bg-navy/10',
    green: 'text-green-600 bg-green-50',
    red:   'text-church-red bg-red-50',
    blue:  'text-blue-600 bg-blue-50',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-charcoal-100 shadow-card p-5"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', colorMap[color])}>
          <Icon className="w-5 h-5" />
        </div>
        {trend !== undefined && (
          <span className={cn('text-xs font-body font-medium', trend >= 0 ? 'text-green-600' : 'text-church-red')}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="font-heading font-bold text-navy text-2xl mb-0.5">{value}</p>
      <p className="font-body text-sm font-medium text-charcoal-600">{label}</p>
      {sub && <p className="font-body text-xs text-charcoal-400 mt-0.5">{sub}</p>}
    </motion.div>
  );
}

// ---- Feature Toggle Card ----
const MODULE_META: Record<string, { label: string; icon: any; description: string; alwaysOn?: boolean }> = {
  home:         { label: 'Home',           icon: LayoutDashboard, description: 'Public home page & announcements', alwaysOn: true },
  profile:      { label: 'Profile',        icon: Users,           description: 'Member profiles & verification',   alwaysOn: true },
  regions:      { label: 'Global Map',     icon: Globe,           description: 'Regions & globe page',              alwaysOn: true },
  branches:     { label: 'Branches',       icon: GitBranch,       description: 'Branch directory & details' },
  messaging:    { label: 'Messaging',      icon: MessageSquare,   description: 'Real-time member messaging' },
  marketplace:  { label: 'Marketplace',    icon: ShoppingBag,     description: 'Product listings & orders' },
  jobs:         { label: 'Jobs',           icon: Briefcase,       description: 'Job postings & applications' },
  sermons:      { label: 'Sermons',        icon: BookOpen,        description: 'Audio sermon library' },
  praise_songs: { label: 'Praise Songs',   icon: Music,           description: 'Music platform & uploads' },
  announcements:{ label: 'Announcements',  icon: Bell,            description: 'Church-wide announcements' },
};

function FeatureToggleCard({ flag, onToggle }: { flag: any; onToggle: (key: string, enabled: boolean) => void }) {
  const meta = MODULE_META[flag.key] || { label: flag.key, icon: Settings, description: '', alwaysOn: false };
  const Icon = meta.icon;

  return (
    <div
      className={cn(
        'bg-white rounded-xl border p-4 transition-all duration-200',
        flag.isEnabled
          ? 'border-gold/30 shadow-sm'
          : 'border-charcoal-100',
        meta.alwaysOn && 'opacity-80 cursor-not-allowed',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
              flag.isEnabled ? 'bg-gold/10 text-gold-700' : 'bg-charcoal-100 text-charcoal-400',
            )}
          >
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-body font-semibold text-navy text-sm">{meta.label}</p>
              {meta.alwaysOn && (
                <span className="text-[10px] bg-charcoal-100 text-charcoal-500 rounded-full px-2 py-0.5 font-body">
                  Always On
                </span>
              )}
            </div>
            <p className="text-xs text-charcoal-400 font-body truncate">{meta.description}</p>
          </div>
        </div>

        {/* Toggle switch */}
        <button
          disabled={meta.alwaysOn}
          onClick={() => !meta.alwaysOn && onToggle(flag.key, !flag.isEnabled)}
          className={cn(
            'relative flex-shrink-0 w-11 h-6 rounded-full transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gold/50',
            flag.isEnabled ? 'bg-gold' : 'bg-charcoal-200',
            meta.alwaysOn && 'cursor-not-allowed opacity-60',
          )}
          title={meta.alwaysOn ? 'This module cannot be disabled' : flag.isEnabled ? 'Disable module' : 'Enable module'}
        >
          <span
            className={cn(
              'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200',
              flag.isEnabled ? 'left-5' : 'left-0.5',
            )}
          />
        </button>
      </div>

      {/* Status indicator */}
      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-charcoal-50">
        <span className={cn('w-1.5 h-1.5 rounded-full', flag.isEnabled ? 'bg-green-400' : 'bg-charcoal-300')} />
        <span className="text-[11px] text-charcoal-400 font-body">
          {flag.isEnabled ? 'Live — accessible to users' : 'Disabled — returns 503 on access'}
        </span>
      </div>
    </div>
  );
}

// ---- Sidebar nav ----
type AdminSection =
  | 'overview' | 'features' | 'branches' | 'users' | 'moderation'
  | 'marketplace' | 'jobs' | 'media' | 'emails' | 'audit' | 'settings';

const SIDEBAR: { key: AdminSection; label: string; icon: any }[] = [
  { key: 'overview',    label: 'Overview',     icon: LayoutDashboard },
  { key: 'features',    label: 'Feature Flags', icon: ToggleLeft },
  { key: 'users',       label: 'Users',         icon: Users },
  { key: 'branches',    label: 'Branches',      icon: GitBranch },
  { key: 'moderation',  label: 'Moderation',    icon: Shield },
  { key: 'marketplace', label: 'Marketplace',   icon: ShoppingBag },
  { key: 'jobs',        label: 'Jobs',          icon: Briefcase },
  { key: 'media',       label: 'Media',         icon: FileText },
  { key: 'emails',      label: 'Email Templates', icon: Mail },
  { key: 'audit',       label: 'Audit Logs',    icon: Activity },
  { key: 'settings',    label: 'Settings',      icon: Settings },
];

export default function AdminPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [section, setSection] = useState<AdminSection>('overview');

  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/api/v1/admin/stats').then((r) => r.data),
  });

  const { data: flagsData } = useQuery({
    queryKey: ['admin-feature-flags'],
    queryFn: () => api.get('/api/v1/admin/feature-flags').then((r) => r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      api.patch(`/api/v1/admin/feature-flags/${key}`, { enabled }).then((r) => r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-feature-flags'] });
      qc.invalidateQueries({ queryKey: ['feature-flags'] });
      toast({
        title: vars.enabled ? '✓ Module enabled' : '⊘ Module disabled',
        description: `${vars.key} has been ${vars.enabled ? 'enabled' : 'disabled'}.`,
      });
    },
  });

  return (
    <div className="pt-16 min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-charcoal-100 shadow-sm fixed top-16 bottom-0 z-20 overflow-y-auto">
        <div className="px-4 py-5 border-b border-charcoal-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center">
              <Shield className="w-4 h-4 text-gold" />
            </div>
            <div>
              <p className="font-heading font-bold text-navy text-sm">Admin Panel</p>
              <p className="text-[11px] text-charcoal-400 font-body">Super Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {SIDEBAR.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSection(key)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-body text-left transition-all',
                section === key
                  ? 'bg-navy text-white font-semibold'
                  : 'text-charcoal-600 hover:bg-charcoal-50 hover:text-navy',
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
              {section === key && <ChevronRight className="w-3 h-3 ml-auto opacity-60" />}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:ml-64 px-4 sm:px-6 py-8">
        {/* Overview */}
        {section === 'overview' && (
          <div>
            <div className="mb-8">
              <h1 className="font-heading font-bold text-navy text-3xl mb-1">Platform Overview</h1>
              <p className="text-charcoal-500 font-body text-sm">
                Welcome back, {user?.profile?.firstName}. Here's your platform at a glance.
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard icon={Users}       label="Total Members"    value={stats?.totalMembers    || '—'} color="navy"  trend={8}  />
              <StatCard icon={CheckCircle2} label="Verified"        value={stats?.verifiedMembers || '—'} color="green" trend={5}  />
              <StatCard icon={GitBranch}   label="Active Branches"  value={stats?.branches        || '—'} color="gold"             />
              <StatCard icon={AlertTriangle} label="Pending Review" value={stats?.pendingReview   || '—'} color="red"              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
              <StatCard icon={ShoppingBag} label="Marketplace Orders"  value={stats?.orders   || '—'} sub="This month" color="blue"  />
              <StatCard icon={Briefcase}   label="Active Job Posts"    value={stats?.jobs     || '—'} sub="Published"  color="gold"  />
              <StatCard icon={Music}       label="Songs Uploaded"      value={stats?.songs    || '—'} sub="Approved"   color="green" />
            </div>

            {/* Approval queues */}
            <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card p-5">
              <h3 className="font-heading font-bold text-navy text-lg mb-4">Pending Approvals</h3>
              <div className="space-y-2">
                {[
                  { label: 'Verification Requests',  count: stats?.pendingVerifications || 0, color: 'text-blue-600',  href: '/admin/verifications' },
                  { label: 'Marketplace Products',   count: stats?.pendingProducts      || 0, color: 'text-gold-700',  href: '/admin/marketplace/approvals' },
                  { label: 'Job Posts',              count: stats?.pendingJobs          || 0, color: 'text-green-600', href: '/admin/jobs/approvals' },
                  { label: 'Song Uploads',           count: stats?.pendingSongs         || 0, color: 'text-purple-600', href: '/admin/songs/approvals' },
                  { label: 'Moderation Cases',       count: stats?.openCases            || 0, color: 'text-church-red', href: '/admin/moderation' },
                ].map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    className="flex items-center justify-between px-4 py-2.5 rounded-lg hover:bg-charcoal-50 transition-colors"
                  >
                    <span className="font-body text-sm text-charcoal-700">{item.label}</span>
                    <span className={cn('font-body font-bold text-sm', item.count > 0 ? item.color : 'text-charcoal-300')}>
                      {item.count}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Feature Flags */}
        {section === 'features' && (
          <div>
            <div className="mb-6">
              <h1 className="font-heading font-bold text-navy text-3xl mb-1">Feature Flags</h1>
              <p className="text-charcoal-500 font-body text-sm max-w-2xl">
                Control which modules are live on the platform. Disabled modules are blocked on
                both the frontend and backend — users cannot access them via navigation or direct URL.
                Changes are instantly applied and fully audited.
              </p>
            </div>

            {/* Warning */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-body font-semibold text-amber-800 text-sm">
                  Server-side enforcement
                </p>
                <p className="font-body text-amber-700 text-xs mt-0.5">
                  Disabling a module blocks API access, removes it from navigation, and returns HTTP 503
                  on direct URL access. All changes are logged to the audit trail.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {(flagsData || []).map((flag: any) => (
                <FeatureToggleCard
                  key={flag.id}
                  flag={flag}
                  onToggle={(key, enabled) => toggleMutation.mutate({ key, enabled })}
                />
              ))}
            </div>
          </div>
        )}

        {/* Audit Logs section */}
        {section === 'audit' && <AuditLogSection />}

        {/* Other sections — placeholder */}
        {!['overview', 'features', 'audit'].includes(section) && (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
            <div className="w-16 h-16 rounded-2xl bg-navy/5 flex items-center justify-center mb-4">
              {(() => { const s = SIDEBAR.find((x) => x.key === section); const I = s?.icon; return I ? <I className="w-8 h-8 text-charcoal-300" /> : null; })()}
            </div>
            <h3 className="font-heading text-xl text-navy mb-2">
              {SIDEBAR.find((s) => s.key === section)?.label}
            </h3>
            <p className="font-body text-charcoal-400 text-sm max-w-xs">
              This section is fully implemented in the backend. Full UI coming in Phase 2.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function AuditLogSection() {
  const { data } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => api.get('/api/v1/admin/audit-logs', { params: { limit: 50 } }).then((r) => r.data),
  });

  return (
    <div>
      <h1 className="font-heading font-bold text-navy text-3xl mb-6">Audit Logs</h1>
      <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card overflow-hidden">
        <table className="w-full text-sm font-body">
          <thead className="bg-charcoal-50 border-b border-charcoal-100">
            <tr>
              {['When', 'Who', 'Action', 'Entity', 'Details'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-semibold text-charcoal-600 text-xs uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-50">
            {(data || []).map((log: any) => (
              <tr key={log.id} className="hover:bg-charcoal-50/50 transition-colors">
                <td className="px-4 py-3 text-charcoal-400 text-xs whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString('en-ZA')}
                </td>
                <td className="px-4 py-3 text-navy font-medium text-xs">
                  {log.user?.profile?.firstName} {log.user?.profile?.surname}
                </td>
                <td className="px-4 py-3">
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-[11px] font-medium',
                    log.action === 'CREATE' ? 'bg-green-50 text-green-700' :
                    log.action === 'DELETE' ? 'bg-red-50 text-church-red' :
                    log.action === 'TOGGLE' ? 'bg-gold/10 text-gold-700' :
                    'bg-charcoal-100 text-charcoal-600',
                  )}>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-charcoal-600 text-xs">{log.entityType}</td>
                <td className="px-4 py-3 text-charcoal-400 text-xs max-w-xs truncate">
                  {log.reason || log.fieldName || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data?.length && (
          <div className="text-center py-12 text-charcoal-400 font-body text-sm">
            No audit log entries yet.
          </div>
        )}
      </div>
    </div>
  );
}
