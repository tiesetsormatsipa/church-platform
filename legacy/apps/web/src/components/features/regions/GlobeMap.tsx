'use client';

import { useMemo, useState } from 'react';
import { Globe2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#D4AF37',
  COMING_SOON: '#3B82F6',
  UNDER_DEVELOPMENT: '#60A5FA',
  PLANNED: '#9CA3AF',
  RESTRICTED: '#4B5563',
  INACTIVE: '#6B7280',
};

const DEFAULT_POINTS: Record<string, { x: number; y: number }> = {
  ZA: { x: 52, y: 72 },
  NA: { x: 49, y: 66 },
  BW: { x: 53, y: 65 },
  LS: { x: 55, y: 73 },
  ZW: { x: 56, y: 63 },
  MZ: { x: 60, y: 66 },
  SZ: { x: 58, y: 71 },
};

interface Country {
  id: string;
  name: string;
  code: string;
  status: string;
}

interface GlobeMapProps {
  countries: Country[];
  onCountryClick?: (country: Country) => void;
  highlightedCountry?: string | null;
}

export default function GlobeMap({ countries, onCountryClick, highlightedCountry }: GlobeMapProps) {
  const [rotation, setRotation] = useState(0);
  const [hovered, setHovered] = useState<Country | null>(null);

  const plotted = useMemo(
    () =>
      countries.map((country, index) => ({
        ...country,
        point: DEFAULT_POINTS[country.code?.toUpperCase()] || {
          x: 22 + ((index * 17) % 56),
          y: 24 + ((index * 11) % 48),
        },
      })),
    [countries],
  );

  return (
    <div className="relative min-h-[500px] overflow-hidden rounded-lg bg-navy">
      <div className="absolute inset-0 church-pattern opacity-10" />
      <div className="absolute inset-x-0 top-0 h-px bg-gold-gradient" />

      <div className="relative grid min-h-[500px] gap-6 p-5 lg:grid-cols-[1fr_260px] lg:p-8">
        <div className="flex items-center justify-center">
          <div
            className="relative aspect-square w-full max-w-[520px] rounded-full border border-gold/25 bg-[radial-gradient(circle_at_35%_25%,rgba(255,255,255,0.18),rgba(27,43,75,0.1)_28%,rgba(15,23,41,0.95)_70%)] shadow-navy"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <div className="absolute inset-[8%] rounded-full border border-white/10" />
            <div className="absolute inset-[18%] rounded-full border border-white/10" />
            <div className="absolute left-1/2 top-[8%] h-[84%] w-px bg-white/10" />
            <div className="absolute left-[8%] top-1/2 h-px w-[84%] bg-white/10" />

            <div className="absolute left-[44%] top-[30%] h-[40%] w-[28%] rounded-[52%_48%_58%_42%] border border-gold/20 bg-white/5" />
            <div className="absolute left-[48%] top-[58%] h-[26%] w-[18%] rounded-[44%_56%_52%_48%] border border-gold/20 bg-white/5" />
            <div className="absolute left-[18%] top-[28%] h-[22%] w-[26%] rounded-[48%_52%_46%_54%] border border-gold/15 bg-white/5" />

            {plotted.map((country) => {
              const active = highlightedCountry === country.id || highlightedCountry === country.code;
              return (
                <button
                  key={country.id}
                  type="button"
                  className={cn(
                    'absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-gold',
                    active && 'scale-125 ring-2 ring-gold',
                  )}
                  style={{
                    left: `${country.point.x}%`,
                    top: `${country.point.y}%`,
                    backgroundColor: STATUS_COLORS[country.status] || STATUS_COLORS.INACTIVE,
                    transform: `translate(-50%, -50%) rotate(${-rotation}deg)`,
                  }}
                  onMouseEnter={() => setHovered(country)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => onCountryClick?.(country)}
                  aria-label={`${country.name}: ${country.status.replace(/_/g, ' ')}`}
                >
                  <MapPin className="h-4 w-4 text-navy" />
                </button>
              );
            })}
          </div>
        </div>

        <aside className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="mb-4 flex items-center gap-2 text-gold">
            <Globe2 className="h-5 w-5" />
            <h3 className="font-heading text-lg font-bold text-white">Expansion Status</h3>
          </div>

          <div className="space-y-2">
            {plotted.map((country) => (
              <button
                key={country.id}
                type="button"
                onClick={() => onCountryClick?.(country)}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition hover:bg-white/10"
              >
                <span className="font-body text-sm text-white">{country.name}</span>
                <span
                  className="rounded-full px-2 py-0.5 font-body text-[11px] font-semibold text-navy"
                  style={{ backgroundColor: STATUS_COLORS[country.status] || STATUS_COLORS.INACTIVE }}
                >
                  {country.status.replace(/_/g, ' ')}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              className="rounded-md border border-gold/30 px-3 py-2 text-sm text-gold transition hover:bg-gold/10"
              onClick={() => setRotation((value) => value - 12)}
            >
              Rotate Left
            </button>
            <button
              type="button"
              className="rounded-md border border-gold/30 px-3 py-2 text-sm text-gold transition hover:bg-gold/10"
              onClick={() => setRotation((value) => value + 12)}
            >
              Rotate Right
            </button>
          </div>
        </aside>
      </div>

      {hovered && (
        <div className="absolute left-5 top-5 rounded-lg border border-gold/30 bg-navy/95 px-4 py-3 shadow-navy">
          <p className="font-body text-sm font-semibold text-gold">{hovered.name}</p>
          <p className="font-body text-xs text-white/70">{hovered.status.replace(/_/g, ' ')}</p>
        </div>
      )}
    </div>
  );
}
