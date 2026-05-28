// apps/web/src/app/admin/moderation/page.tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Shield, AlertTriangle, UserX, Ban, Eye,
  MessageSquare, CheckCircle2, ChevronDown,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from '@/hooks/useToast';

const ACTIONS = [
  { value: 'WARNING',            label: 'Issue Warning',       color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'CONTENT_REMOVED',    label: 'Remove Content',      color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'ACCOUNT_RESTRICTED', label: 'Restrict Account',    color: 'bg-red-50 text-church-red border-red-200' },
  { value: 'ACCOUNT_SUSPENDED',  label: 'Suspend Account',     color: 'bg-red-100 text-church-red border-red-300' },
  { value: 'ACCOUNT_BANNED',     label: 'Permanently Ban',     color: 'bg-charcoal-800 text-white border-charcoal-700' },
  { value: 'CASE_CLOSED',        label: 'Close Case',          color: 'bg-green-50 text-green-700 border-green-200' },
  { value: 'CASE_ESCALATED',     label: 'Escalate Case',       color: 'bg-purple-50 text-purple-700 border-purple-200' },
];

function CaseCard({ mcase, onAction }: { mcase: any; onAction: (caseId: string, action: string, reason: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [selectedAction, setAction] = useState('');
  const [reason, setReason] = useState('');
  const [showForm, setShowForm] = useState(false);

  const subject = mcase.subject;
  const name = `${subject?.profile?.firstName} ${subject?.profile?.surname}`;
  const isOpen = mcase.status === 'OPEN';

  return (
    <div className={cn(
      'bg-white rounded-2xl border shadow-card overflow-hidden',
      isOpen ? 'border-amber-200' : 'border-charcoal-100',
    )}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
              isOpen ? 'bg-amber-50' : 'bg-green-50',
            )}>
              {isOpen
                ? <AlertTriangle className="w-4 h-4 text-amber-600" />
                : <CheckCircle2 className="w-4 h-4 text-green-600" />
              }
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <p className="font-body font-semibold text-navy text-sm">{name}</p>
                <span className={cn(
                  'text-[10px] font-body font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide',
                  isOpen ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700',
                )}>
                  {mcase.status}
                </span>
              </div>
              <p className="font-body text-charcoal-500 text-xs leading-relaxed">{mcase.reason}</p>
              {mcase.description && (
                <p className="font-body text-charcoal-400 text-xs mt-1 italic">{mcase.description}</p>
              )}
              <p className="font-body text-charcoal-300 text-xs mt-1.5">
                Opened {format(new Date(mcase.createdAt), 'dd MMM yyyy, HH:mm')}
              </p>
            </div>
          </div>

          <button onClick={() => setExpanded(!expanded)} className="text-charcoal-400 hover:text-navy transition-colors">
            <ChevronDown className={cn('w-4 h-4 transition-transform', expanded && 'rotate-180')} />
          </button>
        </div>

        {/* Previous actions */}
        {mcase.actions?.length > 0 && (
          <div className="mt-3 pt-3 border-t border-charcoal-50 flex flex-wrap gap-2">
            {mcase.actions.map((a: any) => {
              const actionMeta = ACTIONS.find((x) => x.value === a.action);
              return (
                <span key={a.id} className={cn('text-xs font-body font-medium px-2.5 py-1 rounded-full border', actionMeta?.color || 'bg-charcoal-50 text-charcoal-500 border-charcoal-200')}>
                  {actionMeta?.label || a.action}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {expanded && isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="border-t border-charcoal-50 px-5 py-4"
        >
          <p className="font-body font-semibold text-charcoal-500 text-xs uppercase tracking-wider mb-3">
            Take Action
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {ACTIONS.map((action) => (
              <button
                key={action.value}
                onClick={() => { setAction(action.value); setShowForm(true); }}
                className={cn(
                  'text-xs font-body font-medium px-3 py-1.5 rounded-xl border transition-all',
                  selectedAction === action.value ? action.color : 'bg-white text-charcoal-600 border-charcoal-200 hover:border-charcoal-300',
                )}
              >
                {action.label}
              </button>
            ))}
          </div>

          {showForm && selectedAction && (
            <div className="space-y-3">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason / notes for this action..."
                rows={2}
                className="w-full px-3 py-2 border border-charcoal-200 rounded-xl text-xs font-body focus:outline-none focus:ring-2 focus:ring-gold/30 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { onAction(mcase.id, selectedAction, reason); setExpanded(false); }}
                  disabled={!reason.trim()}
                  className="px-4 py-2 bg-navy text-white text-xs font-body font-semibold rounded-xl hover:bg-navy-700 transition-colors disabled:opacity-50"
                >
                  Confirm Action
                </button>
                <button
                  onClick={() => { setShowForm(false); setAction(''); setReason(''); }}
                  className="px-3 py-2 border border-charcoal-200 rounded-xl text-xs font-body hover:bg-charcoal-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

export default function AdminModerationPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatus] = useState('OPEN');

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ['moderation-cases', statusFilter],
    queryFn: () =>
      api.get('/api/v1/admin/moderation/cases', {
        params: { status: statusFilter !== 'all' ? statusFilter : undefined },
      }).then((r) => r.data),
  });

  const actionMutation = useMutation({
    mutationFn: ({ caseId, action, reason }: { caseId: string; action: string; reason: string }) =>
      api.post(`/api/v1/admin/moderation/cases/${caseId}/action`, { action, reason }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['moderation-cases'] });
      toast({ title: '✓ Action recorded', description: 'Moderation action has been logged.' });
    },
  });

  const openCount   = (cases as any[]).filter((c) => c.status === 'OPEN').length;
  const closedCount = (cases as any[]).filter((c) => c.status === 'CLOSED').length;

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-heading font-bold text-navy text-3xl mb-1">Moderation</h1>
          <p className="font-body text-charcoal-500 text-sm">
            Review reports, manage abuse cases, and take action on member violations.
          </p>
        </div>
        <div className="flex gap-3">
          <div className="px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl text-center">
            <p className="font-heading font-bold text-amber-700 text-xl">{openCount}</p>
            <p className="font-body text-amber-600 text-xs">Open</p>
          </div>
          <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-xl text-center">
            <p className="font-heading font-bold text-green-700 text-xl">{closedCount}</p>
            <p className="font-body text-green-600 text-xs">Closed</p>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { key: 'OPEN',   label: 'Open Cases' },
          { key: 'CLOSED', label: 'Closed Cases' },
          { key: 'all',    label: 'All' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setStatus(f.key)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-body font-medium transition-all',
              statusFilter === f.key ? 'bg-navy text-white' : 'bg-charcoal-50 text-charcoal-600 hover:bg-charcoal-100',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 skeleton rounded-2xl" />)}
        </div>
      ) : cases.length === 0 ? (
        <div className="text-center py-20">
          <Shield className="w-12 h-12 text-charcoal-200 mx-auto mb-3" />
          <p className="font-body text-charcoal-400">No {statusFilter !== 'all' ? statusFilter.toLowerCase() : ''} moderation cases.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(cases as any[]).map((mcase) => (
            <CaseCard
              key={mcase.id}
              mcase={mcase}
              onAction={(caseId, action, reason) =>
                actionMutation.mutate({ caseId, action, reason })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
