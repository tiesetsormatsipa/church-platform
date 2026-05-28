// apps/web/src/app/admin/geo/page.tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Globe, MapPin, ChevronRight, Plus, Edit3,
  CheckCircle2, Clock, AlertCircle, XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/useToast';

const STATUS_OPTIONS = [
  { value: 'ACTIVE',            label: 'Active',            color: 'text-gold-700 bg-gold/10 border-gold/20' },
  { value: 'COMING_SOON',       label: 'Coming Soon',       color: 'text-blue-700 bg-blue-50 border-blue-200' },
  { value: 'UNDER_DEVELOPMENT', label: 'Under Development', color: 'text-blue-600 bg-blue-50 border-blue-100' },
  { value: 'PLANNED',           label: 'Planned',           color: 'text-charcoal-500 bg-charcoal-50 border-charcoal-200' },
  { value: 'RESTRICTED',        label: 'Restricted',        color: 'text-orange-700 bg-orange-50 border-orange-200' },
  { value: 'INACTIVE',          label: 'Inactive',          color: 'text-charcoal-400 bg-charcoal-50 border-charcoal-100' },
];

function StatusBadge({ status }: { status: string }) {
  const opt = STATUS_OPTIONS.find((o) => o.value === status) || STATUS_OPTIONS[5];
  return (
    <span className={cn('text-xs font-body font-medium px-2.5 py-1 rounded-full border', opt.color)}>
      {opt.label}
    </span>
  );
}

function CountryRow({ country, onStatusChange }: { country: any; onStatusChange: (id: string, status: string, note?: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [newStatus, setNewStatus] = useState(country.status);
  const [note, setNote] = useState('');

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-charcoal-50/50 rounded-xl transition-colors">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {country.flagUrl && (
          <img src={country.flagUrl} alt={country.name} className="w-6 h-4 object-cover rounded-sm flex-shrink-0" />
        )}
        <div className="min-w-0">
          <p className="font-body font-semibold text-navy text-sm truncate">{country.name}</p>
          <p className="text-xs text-charcoal-400 font-body">
            {country.region?.name} · {country._count?.branches || 0} branches
          </p>
        </div>
      </div>

      <StatusBadge status={country.status} />

      {editing ? (
        <div className="flex items-center gap-2">
          <select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
            className="px-2 py-1 border border-charcoal-200 rounded-lg text-xs font-body focus:outline-none focus:ring-2 focus:ring-gold/30 bg-white"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason (optional)"
            className="px-2 py-1 border border-charcoal-200 rounded-lg text-xs font-body focus:outline-none focus:ring-2 focus:ring-gold/30 w-36"
          />
          <button
            onClick={() => { onStatusChange(country.id, newStatus, note); setEditing(false); setNote(''); }}
            className="px-2 py-1 bg-navy text-white text-xs rounded-lg hover:bg-navy-700 transition-colors"
          >
            Save
          </button>
          <button onClick={() => { setEditing(false); setNewStatus(country.status); setNote(''); }}
            className="text-charcoal-400 text-xs hover:text-charcoal-600">✕</button>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="p-1.5 text-charcoal-300 hover:text-navy transition-colors rounded-lg hover:bg-charcoal-100"
          title="Edit status"
        >
          <Edit3 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default function AdminGeoPage() {
  const qc = useQueryClient();
  const [activeContinent, setContinent] = useState<string | null>(null);

  const { data: overview } = useQuery({
    queryKey: ['admin-geo-overview'],
    queryFn: () => api.get('/api/v1/geo/overview').then((r) => r.data),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) =>
      api.patch(`/api/v1/geo/countries/${id}/status`, { status, note }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-geo-overview'] });
      toast({ title: '✓ Status updated', description: 'Geographic status change has been logged.' });
    },
  });

  const continents = overview?.continents || [];
  const countries  = overview?.countries  || [];

  const filteredCountries = activeContinent
    ? countries.filter((c: any) => c.continentId === activeContinent)
    : countries;

  // Stats
  const activeCount = countries.filter((c: any) => c.status === 'ACTIVE').length;
  const comingSoon  = countries.filter((c: any) => ['COMING_SOON', 'UNDER_DEVELOPMENT'].includes(c.status)).length;
  const planned     = countries.filter((c: any) => c.status === 'PLANNED').length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading font-bold text-navy text-3xl mb-1">Geographic Management</h1>
        <p className="font-body text-charcoal-500 text-sm">
          Manage continents, regions, countries, and their expansion status. Status changes are audited and reflected on the global map.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-gold/5 border border-gold/20 rounded-xl p-4 text-center">
          <p className="font-heading font-bold text-gold-700 text-2xl">{activeCount}</p>
          <p className="font-body text-charcoal-500 text-xs">Active Countries</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <p className="font-heading font-bold text-blue-700 text-2xl">{comingSoon}</p>
          <p className="font-body text-charcoal-500 text-xs">Coming Soon / Dev</p>
        </div>
        <div className="bg-charcoal-50 border border-charcoal-200 rounded-xl p-4 text-center">
          <p className="font-heading font-bold text-charcoal-500 text-2xl">{planned}</p>
          <p className="font-body text-charcoal-500 text-xs">Planned</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Continent filter sidebar */}
        <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card p-5">
          <h2 className="font-heading font-bold text-navy text-lg mb-4">Continents</h2>
          <div className="space-y-1">
            <button
              onClick={() => setContinent(null)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-body text-left transition-all',
                !activeContinent ? 'bg-navy text-white' : 'text-charcoal-600 hover:bg-charcoal-50',
              )}
            >
              <Globe className="w-4 h-4 flex-shrink-0" />
              All Continents
              <span className="ml-auto text-xs opacity-60">{countries.length}</span>
            </button>

            {continents.map((cont: any) => {
              const count = countries.filter((c: any) => c.continentId === cont.id).length;
              return (
                <button
                  key={cont.id}
                  onClick={() => setContinent(activeContinent === cont.id ? null : cont.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-body text-left transition-all',
                    activeContinent === cont.id ? 'bg-navy text-white' : 'text-charcoal-600 hover:bg-charcoal-50',
                  )}
                >
                  <MapPin className="w-4 h-4 flex-shrink-0" />
                  {cont.name}
                  <span className="ml-auto text-xs opacity-60">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Countries list */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-charcoal-100 shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-charcoal-50 flex items-center justify-between">
            <h2 className="font-heading font-bold text-navy text-lg">
              Countries
              <span className="ml-2 text-sm font-body font-normal text-charcoal-400">
                ({filteredCountries.length})
              </span>
            </h2>
            <div className="flex items-center gap-2 text-xs font-body text-charcoal-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gold" /> Active</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> Coming Soon</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-charcoal-300" /> Planned</span>
            </div>
          </div>

          <div className="divide-y divide-charcoal-50/50 px-2 py-2">
            {filteredCountries.length === 0 ? (
              <p className="text-center text-sm text-charcoal-400 font-body py-8">No countries found.</p>
            ) : (
              filteredCountries.map((country: any) => (
                <CountryRow
                  key={country.id}
                  country={country}
                  onStatusChange={(id, status, note) =>
                    updateStatusMutation.mutate({ id, status, note })
                  }
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Status legend */}
      <div className="mt-6 bg-white rounded-2xl border border-charcoal-100 shadow-card p-5">
        <h3 className="font-body font-semibold text-navy text-sm mb-4">Status Guide</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {STATUS_OPTIONS.map((opt) => (
            <div key={opt.value} className="flex items-center gap-2">
              <span className={cn('text-xs font-body font-medium px-2 py-0.5 rounded-full border', opt.color)}>
                {opt.label}
              </span>
              <span className="text-xs text-charcoal-400 font-body">
                {opt.value === 'ACTIVE' && '→ Gold on map'}
                {opt.value === 'COMING_SOON' && '→ Blue on map'}
                {opt.value === 'UNDER_DEVELOPMENT' && '→ Blue on map'}
                {opt.value === 'PLANNED' && '→ Gray on map'}
                {opt.value === 'RESTRICTED' && '→ Gray on map'}
                {opt.value === 'INACTIVE' && '→ Gray on map'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
