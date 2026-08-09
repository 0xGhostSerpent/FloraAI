import { Compass, Globe2, Leaf, Sprout } from 'lucide-react';
import { motion } from 'motion/react';
import type { OccurrenceSet } from '../store';
import type { Habitat } from '../services/ai';
import ErrorCard from '../components/ErrorCard';
import MapView, { type MapPoint } from '../components/MapView';

type Props = {
  speciesName: string;
  occurrences: OccurrenceSet | null;
  habitat: Habitat | null;
  isLoading: boolean;
  /** True when GBIF has no backbone match or no wild records at all. */
  noWildRecords: boolean;
  error: string | null;
  onRetry: () => void;
};

export default function WildScreen({
  speciesName,
  occurrences,
  habitat,
  isLoading,
  noWildRecords,
  error,
  onRetry,
}: Props) {
  const points: MapPoint[] =
    occurrences?.records.map((r) => ({
      lat: r.lat,
      lon: r.lon,
      label: [r.country, r.year].filter(Boolean).join(' · '),
    })) ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="px-6 pb-6 pt-2 space-y-5"
    >
      <div>
        <h2 className="text-xl font-bold text-text-main leading-tight italic">{speciesName}</h2>
        <p className="text-xs text-text-muted mt-0.5">Where it grows in the wild</p>
      </div>

      {error && <ErrorCard message={error} onRetry={onRetry} />}

      {isLoading && (
        <div className="bg-bg-card dynamic-border rounded-[var(--radius-dynamic)] p-8 flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-[var(--color-accent)]/30 border-t-[var(--color-accent)] rounded-full animate-spin" />
          <p className="text-sm text-text-muted font-medium">Searching GBIF records…</p>
        </div>
      )}

      {/* Cultivated houseplants routinely have zero wild records; this is the
          common case, not an edge case, and must never render a blank map. */}
      {!isLoading && noWildRecords && (
        <div className="bg-bg-card dynamic-border rounded-[var(--radius-dynamic)] p-6 text-center space-y-3">
          <Sprout size={28} className="mx-auto text-[var(--color-accent)]" />
          <p className="text-sm font-bold text-text-main">No verified wild records in GBIF</p>
          <p className="text-sm text-text-muted leading-relaxed">
            This species is primarily cultivated. Its native range is described below.
          </p>
        </div>
      )}

      {!isLoading && occurrences && !noWildRecords && (
        <>
          <MapView points={points} />

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-bg-card dynamic-border rounded-[var(--radius-dynamic)] p-4">
              <p className="text-[10px] text-[var(--color-accent)] font-bold uppercase tracking-widest">
                Recorded sightings
              </p>
              <p className="text-xl font-bold text-text-main mt-1">
                {occurrences.total.toLocaleString()}
              </p>
              <p className="text-[10px] text-text-muted mt-0.5">
                {occurrences.records.length} plotted
              </p>
            </div>
            <div className="bg-bg-card dynamic-border rounded-[var(--radius-dynamic)] p-4">
              <p className="text-[10px] text-[var(--color-accent)] font-bold uppercase tracking-widest">
                Nearest to you
              </p>
              <p className="text-xl font-bold text-text-main mt-1">
                {occurrences.nearestKm === undefined
                  ? '—'
                  : `${Math.round(occurrences.nearestKm).toLocaleString()} km`}
              </p>
              <p className="text-[10px] text-text-muted mt-0.5">
                {occurrences.nearestKm === undefined ? 'Set a location' : 'from your location'}
              </p>
            </div>
          </div>

          {occurrences.topCountries.length > 0 && (
            <div className="bg-bg-card dynamic-border rounded-[var(--radius-dynamic)] p-4 space-y-2">
              <p className="text-[10px] text-[var(--color-accent)] font-bold uppercase tracking-widest flex items-center gap-1.5">
                <Globe2 size={12} /> Most sightings
              </p>
              {occurrences.topCountries.map((c) => (
                <div key={c.country} className="flex justify-between items-center text-sm">
                  <span className="text-text-main truncate">{c.country}</span>
                  <span className="text-text-muted font-bold shrink-0 ml-3">{c.count}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {habitat && (
        <div className="bg-bg-card dynamic-border rounded-[var(--radius-dynamic)] divide-y divide-text-muted/10">
          {[
            { label: 'Native range', value: habitat.nativeRange, icon: Globe2 },
            { label: 'Habitat', value: habitat.habitat, icon: Leaf },
            { label: 'Season', value: habitat.season, icon: Sprout },
            { label: 'What to look for', value: habitat.whatToLookFor, icon: Compass },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="p-4 flex gap-3 items-start">
              <Icon size={18} className="text-[var(--color-accent)] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-text-main">{label}</p>
                <p className="text-sm text-text-muted leading-relaxed mt-0.5">{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-text-muted opacity-80 leading-relaxed text-center px-2">
        Occurrence data from GBIF. Range and habitat notes are AI-generated. Never forage or handle a
        wild plant on this basis alone.
      </p>
    </motion.div>
  );
}
