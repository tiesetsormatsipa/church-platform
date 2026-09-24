// apps/web/src/app/regions/page.tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import {
  Globe2, Search, ChevronDown, MapPin,
  CheckCircle2, Clock, Loader2, XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

// Globe is heavy — load dynamically, SSR off
const GlobeComponent = dynamic(() => import('@/components/features/regions/GlobeMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] flex items-center justify-center bg-navy/5 rounded-2xl">
      <div className="flex flex-col items-center gap-3 text-charcoal-400">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
        <p className="text-sm font-body">Loading globe...</p>
      </div>
    </div>
  ),
});

const STATUS_CONFIG = {
  ACTIVE:            { label: 'Active',            color: '#D4AF37', bg: 'status-active',      icon: CheckCircle2 },
  COMING_SOON:       { label: 'Coming Soon',       color: '#3B82F6', bg: 'status-coming',      icon: Clock },
  UNDER_DEVELOPMENT: { label: 'Under Development', color: '#3B82F6', bg: 'status-coming',      icon: Loader2 },
  PLANNED:           { label: 'Planned',           color: '#9CA3AF', bg: 'status-unavailable', icon: MapPin },
  RESTRICTED:        { label: 'Restricted',        color: '#6B7280', bg: 'status-unavailable', icon: XCircle },
  INACTIVE:          { label: 'Not Available',     color: '#9CA3AF', bg: 'status-unavailable', icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.INACTIVE;
  const Icon = config.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-body font-medium px-2.5 py-1 rounded-full', config.bg)}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
}

function CountryListCard({ country, onClick }: { country: any; onClick: () => void }) {
  const config = STATUS_CONFIG[country.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.INACTIVE;
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-4 rounded-xl border transition-all duration-200',
        country.status === 'ACTIVE'
          ? 'border-gold/30 bg-gold/5 hover:bg-gold/10 hover:border-gold/50 cursor-pointer'
          : 'border-charcoal-100 bg-white hover:bg-charcoal-50 cursor-pointer',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          {country.flagUrl && (
            <img src={country.flagUrl} alt={country.name} className="w-7 h-5 object-cover rounded-sm" />
          )}
          <div>
            <p className="font-body font-semibold text-navy text-sm">{country.name}</p>
            <p className="text-xs text-charcoal-400 font-body">{country.region?.name}</p>
          </div>
        </div>
        <StatusBadge status={country.status} />
      </div>
    </button>
  );
}

export default function RegionsPage() {
  const [search, setSearch]           = useState('');
  const [selectedContinent, setContinent] = useState('all');
  const [selectedRegion, setRegion]   = useState('all');
  const [selectedCountry, setSelectedCountry] = useState<any>(null);
  const [highlightedCountry, setHighlighted] = useState<string | null>(null);

  const { data: geoData } = useQuery({
    queryKey: ['geo-overview'],
    queryFn: () => api.get('/api/v1/geo/overview').then((r) => r.data),
  });

  const { data: selectedDetail } = useQuery({
    queryKey: ['country-detail', selectedCountry?.id],
    queryFn: () =>
      api.get(`/api/v1/geo/countries/${selectedCountry.id}`).then((r) => r.data),
    enabled: !!selectedCountry,
  });

  const continents = geoData?.continents || [];
  const regions    = geoData?.regions?.filter(
    (r: any) => selectedContinent === 'all' || r.continentId === selectedContinent,
  ) || [];
  const countries  = (geoData?.countries || []).filter((c: any) => {
    const matchesSearch = !search || c.name.toLowerCase().includes(search.toLowerCase());
    const matchesCont   = selectedContinent === 'all' || c.continentId === selectedContinent;
    const matchesRegion = selectedRegion === 'all' || c.regionId === selectedRegion;
    return matchesSearch && matchesCont && matchesRegion;
  });

  const activeCount    = countries.filter((c: any) => c.status === 'ACTIVE').length;
  const comingSoonCount = countries.filter((c: any) => ['COMING_SOON', 'UNDER_DEVELOPMENT'].includes(c.status)).length;

  return (
    <div className="pt-16 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-navy-gradient py-16 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 church-pattern opacity-10" />
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gold-gradient" />
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-0.5 bg-gold" />
              <span className="text-gold text-sm font-body uppercase tracking-wider">
                Global Presence
              </span>
            </div>
            <h1 className="font-heading font-bold text-white text-5xl sm:text-6xl mb-3">
              Global Expansion
            </h1>
            <p className="text-white/60 font-body text-lg max-w-xl">
              Explore where our church community is growing across the world.
            </p>

            {/* Stats */}
            <div className="flex flex-wrap gap-6 mt-8">
              <div className="bg-white/5 border border-white/10 rounded-xl px-5 py-3">
                <p className="text-gold font-heading font-bold text-2xl">{activeCount}</p>
                <p className="text-white/60 text-sm font-body">Active Countries</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl px-5 py-3">
                <p className="text-blue-400 font-heading font-bold text-2xl">{comingSoonCount}</p>
                <p className="text-white/60 text-sm font-body">Coming Soon</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl px-5 py-3">
                <p className="text-white font-heading font-bold text-2xl">{continents.length}</p>
                <p className="text-white/60 text-sm font-body">Continents</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Map Legend */}
      <div className="bg-white border-b border-charcoal-100 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-4 text-xs font-body">
          <span className="font-medium text-charcoal-500">Map Legend:</span>
          {Object.entries(STATUS_CONFIG)
            .filter((_, i) => i < 3)
            .map(([key, val]) => (
              <span key={key} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ background: val.color }} />
                <span className="text-charcoal-600">{val.label}</span>
              </span>
            ))}
        </div>
      </div>

      {/* Main layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
          {/* Globe */}
          <div className="order-2 lg:order-1">
            <GlobeComponent
              countries={geoData?.countries || []}
              onCountryClick={(country: any) => setSelectedCountry(country)}
              highlightedCountry={highlightedCountry}
            />
          </div>

          {/* Sidebar */}
          <div className="order-1 lg:order-2 space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card p-5 space-y-3">
              <h3 className="font-heading font-semibold text-navy text-lg">Explore</h3>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
                <input
                  type="text"
                  placeholder="Search country or region..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-charcoal-200 rounded-lg text-sm font-body focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold/50"
                />
              </div>

              {/* Continent filter */}
              <select
                value={selectedContinent}
                onChange={(e) => { setContinent(e.target.value); setRegion('all'); }}
                className="w-full px-3 py-2.5 border border-charcoal-200 rounded-lg text-sm font-body focus:outline-none focus:ring-2 focus:ring-gold/30 bg-white text-charcoal-700"
              >
                <option value="all">All Continents</option>
                {continents.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              {/* Region filter */}
              <select
                value={selectedRegion}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-3 py-2.5 border border-charcoal-200 rounded-lg text-sm font-body focus:outline-none focus:ring-2 focus:ring-gold/30 bg-white text-charcoal-700"
              >
                <option value="all">All Regions</option>
                {regions.map((r: any) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            {/* Selected country detail */}
            <AnimatePresence mode="wait">
              {selectedCountry && (
                <motion.div
                  key={selectedCountry.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white rounded-2xl border border-gold/30 shadow-gold p-5"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-heading font-bold text-navy text-xl">
                        {selectedCountry.name}
                      </h3>
                      <p className="text-sm text-charcoal-400 font-body">
                        {selectedCountry.region?.name} · {selectedCountry.continent?.name}
                      </p>
                    </div>
                    <button onClick={() => setSelectedCountry(null)} className="text-charcoal-400 hover:text-charcoal-600">
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>

                  <StatusBadge status={selectedCountry.status} />

                  {selectedDetail?.branches?.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-body font-medium text-charcoal-400 uppercase tracking-wider mb-2">
                        Branches ({selectedDetail.branches.length})
                      </p>
                      <div className="space-y-2">
                        {selectedDetail.branches.map((b: any) => (
                          <a
                            key={b.id}
                            href={`/branches/${b.id}`}
                            className="flex items-center gap-2 text-sm font-body text-navy hover:text-gold transition-colors"
                          >
                            <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-gold" />
                            {b.name}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedCountry.status !== 'ACTIVE' && (
                    <p className="mt-4 text-xs text-charcoal-400 font-body italic">
                      This region is not yet active. Check back soon for updates.
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Country list */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {countries.map((country: any) => (
                <CountryListCard
                  key={country.id}
                  country={country}
                  onClick={() => {
                    setSelectedCountry(country);
                    setHighlighted(country.code);
                  }}
                />
              ))}
              {countries.length === 0 && (
                <p className="text-center text-sm text-charcoal-400 font-body py-6">
                  No countries match your filters.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
