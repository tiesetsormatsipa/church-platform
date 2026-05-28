// apps/web/src/app/admin/branches/page.tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GitBranch, Search, Plus, Edit3, Eye, MapPin,
  Users, ChevronRight, Building2, Clock,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

function BranchRow({ branch }: { branch: any }) {
  const isMain = branch.type === 'MAIN';
  return (
    <tr className="hover:bg-charcoal-50/50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
            isMain ? 'bg-gold/10' : 'bg-navy/5',
          )}>
            <Building2 className={cn('w-4 h-4', isMain ? 'text-gold-700' : 'text-navy/40')} />
          </div>
          <div>
            <p className="font-body font-semibold text-navy text-sm">{branch.name}</p>
            {branch.parentBranch && (
              <p className="text-xs text-charcoal-400 font-body flex items-center gap-1">
                <GitBranch className="w-3 h-3" /> Under {branch.parentBranch.name}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={cn(
          'text-xs font-body font-semibold px-2.5 py-1 rounded-full',
          isMain ? 'bg-gold/10 text-gold-700 border border-gold/20' : 'bg-charcoal-100 text-charcoal-600',
        )}>
          {isMain ? 'Main Branch' : 'Sub-branch'}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm font-body text-charcoal-600">
          {[branch.city?.name, branch.province?.name, branch.country?.name].filter(Boolean).join(', ')}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 text-sm font-body text-charcoal-500">
          <Users className="w-3.5 h-3.5 text-charcoal-400" />
          {branch.estimatedMembers ? `~${branch.estimatedMembers.toLocaleString()}` : '—'}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 text-sm font-body text-charcoal-500">
          <Clock className="w-3.5 h-3.5 text-charcoal-400" />
          {branch.serviceTimes?.length || 0} service{branch.serviceTimes?.length !== 1 ? 's' : ''}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={cn(
          'text-xs font-body font-medium px-2 py-0.5 rounded-full',
          branch.isActive ? 'text-green-700 bg-green-50' : 'text-charcoal-400 bg-charcoal-50',
        )}>
          {branch.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <Link
            href={`/branches/${branch.id}`}
            className="p-1.5 text-charcoal-400 hover:text-navy rounded-lg hover:bg-charcoal-100 transition-colors"
            title="View"
          >
            <Eye className="w-4 h-4" />
          </Link>
          <button className="p-1.5 text-charcoal-400 hover:text-gold rounded-lg hover:bg-charcoal-100 transition-colors" title="Edit">
            <Edit3 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function AdminBranchesPage() {
  const [search, setSearch]     = useState('');
  const [typeFilter, setType]   = useState('all');
  const [page, setPage]         = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-branches', search, typeFilter, page],
    queryFn: () =>
      api.get('/api/v1/branches', {
        params: {
          search: search || undefined,
          type: typeFilter !== 'all' ? typeFilter : undefined,
          page, limit: 20,
        },
      }).then((r) => r.data),
  });

  const branches = data?.data || [];
  const meta     = data?.meta;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading font-bold text-navy text-3xl mb-1">Branch Management</h1>
          <p className="font-body text-charcoal-500 text-sm">
            Manage all branches, their service times, records, and leadership.
          </p>
        </div>
        <button className="flex items-center gap-2 bg-navy text-white font-body font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-navy-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Branch
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
          <input
            type="text"
            placeholder="Search branches..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2.5 border border-charcoal-200 rounded-lg text-sm font-body focus:outline-none focus:ring-2 focus:ring-gold/30"
          />
        </div>
        <div className="flex gap-2">
          {[
            { key: 'all',  label: 'All' },
            { key: 'MAIN', label: 'Main Branches' },
            { key: 'SUB',  label: 'Sub-branches' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => { setType(f.key); setPage(1); }}
              className={cn(
                'px-3 py-2 rounded-lg text-xs font-body font-medium transition-all',
                typeFilter === f.key ? 'bg-navy text-white' : 'bg-charcoal-50 text-charcoal-600 hover:bg-charcoal-100',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card overflow-hidden">
        <table className="w-full">
          <thead className="bg-charcoal-50 border-b border-charcoal-100">
            <tr>
              {['Branch', 'Type', 'Location', 'Members', 'Services', 'Status', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-body font-semibold text-charcoal-500 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-50">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-4"><div className="h-4 skeleton rounded w-20" /></td>
                    ))}
                  </tr>
                ))
              : branches.map((branch: any) => (
                  <BranchRow key={branch.id} branch={branch} />
                ))
            }
          </tbody>
        </table>

        {branches.length === 0 && !isLoading && (
          <div className="text-center py-12 text-charcoal-400 font-body text-sm">
            No branches found.
          </div>
        )}
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-charcoal-400 font-body">{meta.total} branches total</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 border border-charcoal-200 rounded-lg text-xs font-body disabled:opacity-40 hover:border-gold/40 transition-colors">
              ← Prev
            </button>
            <span className="px-3 py-1.5 text-xs font-body text-charcoal-500">{page} / {meta.totalPages}</span>
            <button disabled={page === meta.totalPages} onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 border border-charcoal-200 rounded-lg text-xs font-body disabled:opacity-40 hover:border-gold/40 transition-colors">
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
