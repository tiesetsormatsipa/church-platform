// apps/web/src/app/admin/users/page.tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, UserCheck, UserX, Clock, CheckCircle2,
  AlertCircle, ChevronDown, Shield, Eye, Filter,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const VERIFICATION_TABS = [
  { key: 'all',      label: 'All Users',       color: 'text-charcoal-600' },
  { key: 'PENDING',  label: 'Pending Review',  color: 'text-blue-600'     },
  { key: 'VERIFIED', label: 'Verified',        color: 'text-green-600'    },
  { key: 'UNVERIFIED', label: 'Unverified',    color: 'text-amber-600'    },
  { key: 'REJECTED', label: 'Rejected',        color: 'text-church-red'   },
];

function VerificationStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    VERIFIED:   { label: 'Verified',         cls: 'bg-green-50 text-green-700 border-green-200' },
    PENDING:    { label: 'Pending',          cls: 'bg-blue-50 text-blue-700 border-blue-200'   },
    UNVERIFIED: { label: 'Unverified',       cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    REJECTED:   { label: 'Rejected',         cls: 'bg-red-50 text-church-red border-red-200'   },
    FLAGGED:    { label: 'Flagged',          cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  };
  const c = config[status] || config.UNVERIFIED;
  return (
    <span className={cn('text-xs font-body font-medium px-2.5 py-1 rounded-full border', c.cls)}>
      {c.label}
    </span>
  );
}

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('all');
  const [page, setPage]           = useState(1);
  const [selectedUser, setSelected] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search, statusFilter, page],
    queryFn: () =>
      api.get('/api/v1/users/admin/list', {
        params: {
          search: search || undefined,
          verificationStatus: statusFilter !== 'all' ? statusFilter : undefined,
          page, limit: 20,
        },
      }).then((r) => r.data),
  });

  const { data: pendingVerifications } = useQuery({
    queryKey: ['verification-queue'],
    queryFn: () => api.get('/api/v1/users/admin/verification-queue').then((r) => r.data),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api.post(`/api/v1/users/admin/${id}/verify`, { notes }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['verification-queue'] });
      setSelected(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/api/v1/users/admin/${id}/reject`, { reason }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['verification-queue'] });
      setSelected(null);
      setRejectReason('');
    },
  });

  const users = data?.data || [];
  const meta  = data?.meta;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading font-bold text-navy text-3xl mb-1">User Management</h1>
          <p className="text-charcoal-500 font-body text-sm">
            Manage members, verification requests, and role assignments.
          </p>
        </div>

        {pendingVerifications?.length > 0 && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 text-sm font-body font-medium px-4 py-2 rounded-xl">
            <Clock className="w-4 h-4" />
            {pendingVerifications.length} pending verification{pendingVerifications.length > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
          <input
            type="text"
            placeholder="Search name or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2.5 border border-charcoal-200 rounded-lg text-sm font-body focus:outline-none focus:ring-2 focus:ring-gold/30"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {VERIFICATION_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setStatus(tab.key); setPage(1); }}
              className={cn(
                'px-3 py-2 rounded-lg text-xs font-body font-medium transition-all',
                statusFilter === tab.key ? 'bg-navy text-white' : 'bg-charcoal-50 text-charcoal-600 hover:bg-charcoal-100',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pending verifications banner */}
      {statusFilter === 'all' && pendingVerifications?.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6">
          <h3 className="font-body font-semibold text-blue-800 text-sm mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Pending Verification Requests
          </h3>
          <div className="space-y-2">
            {pendingVerifications.slice(0, 5).map((vr: any) => (
              <div key={vr.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-blue-100">
                <div>
                  <p className="font-body font-semibold text-navy text-sm">
                    {vr.user?.profile?.firstName} {vr.user?.profile?.surname}
                  </p>
                  <p className="font-body text-charcoal-400 text-xs">
                    {vr.user?.email} · {vr.user?.profile?.country?.name}
                    · Submitted {format(new Date(vr.submittedAt), 'dd MMM yyyy')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => approveMutation.mutate({ id: vr.id })}
                    disabled={approveMutation.isPending}
                    className="flex items-center gap-1.5 bg-green-600 text-white text-xs font-body font-semibold px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button
                    onClick={() => setSelected(vr)}
                    className="flex items-center gap-1.5 bg-red-50 text-church-red text-xs font-body font-semibold px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors border border-red-200"
                  >
                    <UserX className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users table */}
      <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card overflow-hidden">
        <table className="w-full">
          <thead className="bg-charcoal-50 border-b border-charcoal-100">
            <tr>
              {['Member', 'Email', 'Branch', 'Roles', 'Verification', 'Joined'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-body font-semibold text-charcoal-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-50">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-4">
                        <div className="h-4 skeleton rounded w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              : users.map((user: any) => (
                  <tr key={user.id} className="hover:bg-charcoal-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center flex-shrink-0 text-navy font-bold text-xs">
                          {user.profile?.firstName?.[0] || '?'}
                        </div>
                        <div>
                          <p className="font-body font-semibold text-navy text-sm">
                            {user.profile?.firstName} {user.profile?.surname}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-charcoal-500 text-xs font-body">
                      {user.email}
                    </td>
                    <td className="px-4 py-3 text-charcoal-500 text-xs font-body">
                      {user.profile?.branchId ? '—' : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {user.userRoles?.slice(0, 2).map((ur: any) => (
                          <span key={ur.role?.id} className="text-[11px] bg-navy/5 text-navy rounded-full px-2 py-0.5 font-body">
                            {ur.role?.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <VerificationStatusBadge status={user.verificationStatus} />
                    </td>
                    <td className="px-4 py-3 text-charcoal-400 text-xs font-body">
                      {user.createdAt ? format(new Date(user.createdAt), 'dd/MM/yyyy') : '—'}
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>

        {users.length === 0 && !isLoading && (
          <div className="text-center py-12 text-charcoal-400 font-body text-sm">
            No users match your filters.
          </div>
        )}
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-charcoal-400 font-body">
            {meta.total} total members
          </span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 border border-charcoal-200 rounded-lg text-xs font-body disabled:opacity-40 hover:border-gold/40 transition-colors">
              ← Prev
            </button>
            <span className="px-3 py-1.5 text-xs font-body text-charcoal-500">
              {page} / {meta.totalPages}
            </span>
            <button disabled={page === meta.totalPages} onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 border border-charcoal-200 rounded-lg text-xs font-body disabled:opacity-40 hover:border-gold/40 transition-colors">
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
          >
            <h3 className="font-heading font-bold text-navy text-xl mb-1">Reject Verification</h3>
            <p className="font-body text-charcoal-500 text-sm mb-4">
              Provide a clear reason so the member can address the issue and resubmit.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Reason for rejection..."
              className="w-full px-4 py-3 border border-charcoal-200 rounded-xl text-sm font-body focus:outline-none focus:ring-2 focus:ring-gold/30 resize-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => rejectMutation.mutate({ id: selectedUser.id, reason: rejectReason })}
                disabled={!rejectReason.trim() || rejectMutation.isPending}
                className="flex-1 bg-church-red text-white font-body font-semibold py-2.5 rounded-xl hover:bg-red-800 transition-colors disabled:opacity-50"
              >
                {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
              <button
                onClick={() => { setSelected(null); setRejectReason(''); }}
                className="px-4 py-2.5 border border-charcoal-200 rounded-xl text-charcoal-600 font-body text-sm hover:bg-charcoal-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
