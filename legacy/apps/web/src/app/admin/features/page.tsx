// apps/web/src/app/admin/features/page.tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ToggleLeft, AlertTriangle, CheckCircle2, Clock,
  Users, Globe, Shield, ChevronDown, Plus, Trash2,
  Info, BarChart3,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/useToast';

const MODULE_META: Record<string, { label: string; description: string; alwaysOn?: boolean; color: string }> = {
  home:          { label: 'Home',             description: 'Public home page, hero, countdown, announcements', alwaysOn: true,  color: 'bg-charcoal-100 text-charcoal-500' },
  profile:       { label: 'Profile',          description: 'Member profiles, registration, verification',      alwaysOn: true,  color: 'bg-charcoal-100 text-charcoal-500' },
  regions:       { label: 'Global Map',       description: 'Regions, globe page, geographic expansion',        alwaysOn: true,  color: 'bg-charcoal-100 text-charcoal-500' },
  branches:      { label: 'Branches',         description: 'Branch directory, detail pages, records',          alwaysOn: false, color: 'bg-navy/10 text-navy' },
  announcements: { label: 'Announcements',    description: 'Church announcements and notice board',            alwaysOn: false, color: 'bg-navy/10 text-navy' },
  messaging:     { label: 'Messaging',        description: 'Real-time messaging, order threads, job threads',  alwaysOn: false, color: 'bg-blue-50 text-blue-700' },
  marketplace:   { label: 'Marketplace',      description: 'Product listings, stores, orders, payments',       alwaysOn: false, color: 'bg-amber-50 text-amber-700' },
  jobs:          { label: 'Jobs Board',       description: 'Job postings, applications, employer tools',       alwaysOn: false, color: 'bg-green-50 text-green-700' },
  sermons:       { label: 'Sermons',          description: 'Audio sermon library, upload, streaming',          alwaysOn: false, color: 'bg-purple-50 text-purple-700' },
  praise_songs:  { label: 'Praise Songs',     description: 'Music platform, uploads, approval, playback',      alwaysOn: false, color: 'bg-rose-50 text-rose-700' },
};

const ROLLOUT_RULE_TYPES = [
  { value: 'ALL',                 label: 'All users'                },
  { value: 'ROLE',                label: 'Specific role'            },
  { value: 'COUNTRY',             label: 'Specific country'         },
  { value: 'VERIFICATION_STATUS', label: 'Verification status'      },
  { value: 'PERCENTAGE',          label: 'Percentage rollout'       },
];

function RolloutRuleBadge({ rule }: { rule: any }) {
  const labels: Record<string, string> = {
    ALL:                 'All users',
    ROLE:                `Role: ${rule.ruleValue}`,
    COUNTRY:             `Country: ${rule.ruleValue}`,
    VERIFICATION_STATUS: `Status: ${rule.ruleValue}`,
    PERCENTAGE:          `${rule.percentage}% of users`,
  };
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-navy/5 text-navy border border-navy/10 rounded-full px-2.5 py-1 font-body">
      <BarChart3 className="w-3 h-3" />
      {labels[rule.ruleType] || rule.ruleType}
    </span>
  );
}

function FeatureFlagCard({ flag, onToggle }: { flag: any; onToggle: (key: string, enabled: boolean, reason?: string) => void }) {
  const meta = MODULE_META[flag.key] || {
    label: flag.key,
    description: '',
    alwaysOn: false,
    color: 'bg-charcoal-100 text-charcoal-500',
  };
  const [expanded, setExpanded] = useState(false);
  const [showRolloutForm, setShowRolloutForm] = useState(false);
  const [toggleReason, setToggleReason] = useState('');
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [newRule, setNewRule] = useState({ ruleType: 'ALL', ruleValue: '', percentage: 100 });
  const qc = useQueryClient();

  const addRuleMutation = useMutation({
    mutationFn: (rule: any) =>
      api.post(`/api/v1/admin/feature-flags/${flag.key}/rollout-rules`, rule).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-feature-flags'] });
      setShowRolloutForm(false);
      setNewRule({ ruleType: 'ALL', ruleValue: '', percentage: 100 });
      toast({ title: '✓ Rollout rule added' });
    },
  });

  const handleToggle = () => {
    if (meta.alwaysOn) return;
    if (!toggleReason.trim() && !flag.isEnabled) {
      // Require reason when enabling a module
      setShowReasonInput(true);
      return;
    }
    onToggle(flag.key, !flag.isEnabled, toggleReason || undefined);
    setShowReasonInput(false);
    setToggleReason('');
  };

  return (
    <motion.div
      layout
      className={cn(
        'bg-white rounded-2xl border shadow-card overflow-hidden transition-all duration-200',
        flag.isEnabled ? 'border-gold/30' : 'border-charcoal-100',
      )}
    >
      {/* Card header */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Status indicator */}
          <div className={cn('w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0', flag.isEnabled ? 'bg-green-400' : 'bg-charcoal-300')} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-heading font-bold text-navy text-base">{meta.label}</h3>
              {meta.alwaysOn && (
                <span className="text-[10px] font-body font-semibold bg-charcoal-100 text-charcoal-500 rounded-full px-2 py-0.5 uppercase tracking-wide">
                  Always On
                </span>
              )}
              <span className={cn('text-[10px] font-body font-semibold rounded-full px-2 py-0.5 uppercase tracking-wide', meta.color)}>
                {flag.key}
              </span>
            </div>
            <p className="font-body text-charcoal-400 text-xs leading-relaxed">{meta.description}</p>
          </div>

          {/* Toggle */}
          <button
            disabled={meta.alwaysOn}
            onClick={handleToggle}
            className={cn(
              'relative flex-shrink-0 w-12 h-6 rounded-full transition-all duration-300',
              'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gold/50',
              flag.isEnabled ? 'bg-gold shadow-gold' : 'bg-charcoal-200',
              meta.alwaysOn && 'opacity-50 cursor-not-allowed',
            )}
            title={meta.alwaysOn ? 'This module is always required' : undefined}
          >
            <span className={cn(
              'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-300',
              flag.isEnabled ? 'left-6' : 'left-0.5',
            )} />
          </button>
        </div>

        {/* Status line */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-charcoal-50">
          <div className="flex items-center gap-2">
            {flag.isEnabled ? (
              <span className="flex items-center gap-1.5 text-xs text-green-600 font-body">
                <CheckCircle2 className="w-3.5 h-3.5" /> Live — accessible to all users
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-charcoal-400 font-body">
                <AlertTriangle className="w-3.5 h-3.5" /> Disabled — returns 503 on access
              </span>
            )}
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-charcoal-400 hover:text-navy font-body transition-colors"
          >
            {flag.rolloutRules?.length > 0 && (
              <span className="bg-navy/5 text-navy rounded-full px-1.5 py-0.5 text-[10px] font-bold mr-1">
                {flag.rolloutRules.length} rules
              </span>
            )}
            {expanded ? 'Less' : 'More'}
            <ChevronDown className={cn('w-3 h-3 transition-transform', expanded && 'rotate-180')} />
          </button>
        </div>
      </div>

      {/* Reason input for enabling */}
      <AnimatePresence>
        {showReasonInput && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-5 pb-4 border-t border-charcoal-50 overflow-hidden"
          >
            <p className="text-xs text-charcoal-500 font-body mb-2 mt-3">
              Provide a reason for enabling this module (will be logged):
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={toggleReason}
                onChange={(e) => setToggleReason(e.target.value)}
                placeholder="e.g. Phase 2 launch, approved by leadership..."
                className="flex-1 px-3 py-2 border border-charcoal-200 rounded-lg text-xs font-body focus:outline-none focus:ring-2 focus:ring-gold/30"
              />
              <button
                onClick={() => { onToggle(flag.key, true, toggleReason); setShowReasonInput(false); setToggleReason(''); }}
                disabled={!toggleReason.trim()}
                className="px-3 py-2 bg-navy text-white text-xs font-body font-semibold rounded-lg hover:bg-navy-700 transition-colors disabled:opacity-50"
              >
                Enable
              </button>
              <button
                onClick={() => { setShowReasonInput(false); setToggleReason(''); }}
                className="px-3 py-2 border border-charcoal-200 rounded-lg text-xs font-body hover:bg-charcoal-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded: rollout rules */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-charcoal-50"
          >
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-body font-semibold text-charcoal-500 uppercase tracking-wider">
                  Rollout Rules
                </p>
                <button
                  onClick={() => setShowRolloutForm(!showRolloutForm)}
                  className="flex items-center gap-1 text-xs text-gold-700 font-body hover:text-gold transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add rule
                </button>
              </div>

              {flag.rolloutRules?.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-3">
                  {flag.rolloutRules.map((rule: any) => (
                    <RolloutRuleBadge key={rule.id} rule={rule} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-charcoal-300 font-body mb-3 italic">
                  No rollout rules — toggle applies to all users when enabled.
                </p>
              )}

              {/* Add rule form */}
              {showRolloutForm && (
                <div className="bg-charcoal-50 rounded-xl p-4 space-y-3 mt-2">
                  <p className="text-xs font-body font-semibold text-charcoal-600">New Rollout Rule</p>
                  <select
                    value={newRule.ruleType}
                    onChange={(e) => setNewRule((r) => ({ ...r, ruleType: e.target.value }))}
                    className="w-full px-3 py-2 border border-charcoal-200 rounded-lg text-xs font-body focus:outline-none focus:ring-2 focus:ring-gold/30 bg-white"
                  >
                    {ROLLOUT_RULE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>

                  {newRule.ruleType !== 'ALL' && newRule.ruleType !== 'PERCENTAGE' && (
                    <input
                      type="text"
                      value={newRule.ruleValue}
                      onChange={(e) => setNewRule((r) => ({ ...r, ruleValue: e.target.value }))}
                      placeholder={newRule.ruleType === 'ROLE' ? 'e.g. branch-admin' : newRule.ruleType === 'COUNTRY' ? 'Country ID' : 'Value'}
                      className="w-full px-3 py-2 border border-charcoal-200 rounded-lg text-xs font-body focus:outline-none focus:ring-2 focus:ring-gold/30"
                    />
                  )}

                  {newRule.ruleType === 'PERCENTAGE' && (
                    <div className="flex items-center gap-3">
                      <input
                        type="range" min={1} max={100} value={newRule.percentage}
                        onChange={(e) => setNewRule((r) => ({ ...r, percentage: +e.target.value }))}
                        className="flex-1"
                      />
                      <span className="text-xs font-body font-bold text-navy w-12 text-right">{newRule.percentage}%</span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => addRuleMutation.mutate(newRule)}
                      disabled={addRuleMutation.isPending}
                      className="px-3 py-1.5 bg-navy text-white text-xs font-body font-semibold rounded-lg hover:bg-navy-700 transition-colors disabled:opacity-50"
                    >
                      {addRuleMutation.isPending ? 'Adding...' : 'Add Rule'}
                    </button>
                    <button
                      onClick={() => setShowRolloutForm(false)}
                      className="px-3 py-1.5 border border-charcoal-200 rounded-lg text-xs font-body hover:bg-charcoal-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* History preview */}
              {flag.history?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-charcoal-50">
                  <p className="text-[10px] font-body font-semibold text-charcoal-400 uppercase tracking-wider mb-2">
                    Recent changes
                  </p>
                  {flag.history.slice(0, 3).map((h: any) => (
                    <div key={h.id} className="flex items-center gap-2 text-[11px] font-body text-charcoal-400 mb-1">
                      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', h.newValue ? 'bg-green-400' : 'bg-charcoal-300')} />
                      <span>{h.newValue ? 'Enabled' : 'Disabled'}</span>
                      {h.reason && <span className="text-charcoal-300">· {h.reason}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function AdminFeaturesPage() {
  const qc = useQueryClient();

  const { data: flags = [], isLoading } = useQuery({
    queryKey: ['admin-feature-flags'],
    queryFn: () =>
      api.get('/api/v1/admin/feature-flags').then((r) => r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ key, enabled, reason }: { key: string; enabled: boolean; reason?: string }) =>
      api.patch(`/api/v1/admin/feature-flags/${key}`, { enabled, reason }).then((r) => r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-feature-flags'] });
      qc.invalidateQueries({ queryKey: ['feature-flags-nav'] });
      toast({
        title: vars.enabled ? '✓ Module enabled' : '⊘ Module disabled',
        description: `"${vars.key}" is now ${vars.enabled ? 'live on the platform' : 'inaccessible to all users'}.`,
      });
    },
    onError: (err: any) => {
      toast({ title: '✗ Error', description: err?.response?.data?.message || 'Toggle failed' });
    },
  });

  const enabledCount  = flags.filter((f: any) => f.isEnabled).length;
  const disabledCount = flags.filter((f: any) => !f.isEnabled).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-heading font-bold text-navy text-3xl mb-1">Feature Flags</h1>
          <p className="font-body text-charcoal-500 text-sm max-w-2xl">
            Control which modules are live. Disabled modules are blocked server-side —
            no frontend navigation, no API access, no direct URL. All changes are audited.
          </p>
        </div>
        <div className="flex gap-3">
          <div className="text-center px-4 py-2 bg-green-50 border border-green-200 rounded-xl">
            <p className="font-heading font-bold text-green-700 text-xl">{enabledCount}</p>
            <p className="text-green-600 text-xs font-body">Active</p>
          </div>
          <div className="text-center px-4 py-2 bg-charcoal-50 border border-charcoal-200 rounded-xl">
            <p className="font-heading font-bold text-charcoal-500 text-xl">{disabledCount}</p>
            <p className="text-charcoal-400 text-xs font-body">Disabled</p>
          </div>
        </div>
      </div>

      {/* Security note */}
      <div className="bg-navy/5 border border-navy/10 rounded-xl p-4 mb-6 flex items-start gap-3">
        <Info className="w-4 h-4 text-navy/50 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-body text-navy/70 text-xs leading-relaxed">
            <strong>Server-side enforcement:</strong> Disabling a module removes it from navigation, blocks direct URL access with HTTP 503, and guards all related API endpoints. The FeatureGuard runs on every request — there is no client-side bypass.
            Rollout rules let you enable a module for specific roles, countries, or a percentage of users before a full launch.
          </p>
        </div>
      </div>

      {/* Always-on section */}
      <h2 className="font-body font-semibold text-charcoal-400 text-xs uppercase tracking-wider mb-3">
        Always Active — Cannot Be Disabled
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {flags
          .filter((f: any) => MODULE_META[f.key]?.alwaysOn)
          .map((flag: any) => (
            <FeatureFlagCard
              key={flag.id}
              flag={flag}
              onToggle={(key, enabled, reason) => toggleMutation.mutate({ key, enabled, reason })}
            />
          ))}
      </div>

      {/* Toggleable modules */}
      <h2 className="font-body font-semibold text-charcoal-400 text-xs uppercase tracking-wider mb-3">
        Toggleable Modules
      </h2>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-28 skeleton rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {flags
            .filter((f: any) => !MODULE_META[f.key]?.alwaysOn)
            .map((flag: any) => (
              <FeatureFlagCard
                key={flag.id}
                flag={flag}
                onToggle={(key, enabled, reason) => toggleMutation.mutate({ key, enabled, reason })}
              />
            ))}
        </div>
      )}
    </div>
  );
}
