import { Compass, Globe2, Leaf, RefreshCw, Sprout, type LucideIcon } from 'lucide-react';
import type { OccurrenceSet } from '../store';
import type { Habitat } from '../services/ai';
import MapView, { type MapPoint } from '../components/MapView';
import { Button, Card, Disclaimer, Eyebrow, LoadingState, Notice, Page, PageHeader } from '../components/ui';

type Props = {
  speciesName: string;
  occurrences: OccurrenceSet | null;
  habitat: Habitat | null;
  isLoading: boolean;
  /** True when GBIF has no backbone match or no wild records at all. */
  noWildRecords: boolean;
  error: string | null;
  onRetry: () => void;
  onBack: () => void;
};

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card>
      <Eyebrow>{label}</Eyebrow>
      <p className="mt-2 whitespace-nowrap font-display text-2xl font-semibold leading-none lining-nums tabular-nums text-ink">{value}</p>
      <p className="mt-1.5 text-[13px] text-muted">{detail}</p>
    </Card>
  );
}

export default function WildScreen({
  speciesName,
  occurrences,
  habitat,
  isLoading,
  noWildRecords,
  error,
  onRetry,
  onBack,
}: Props) {
  const points: MapPoint[] =
    occurrences?.records.map((r) => ({
      lat: r.lat,
      lon: r.lon,
      label: [r.country, r.year].filter(Boolean).join(' · '),
    })) ?? [];

  const topMax = Math.max(1, ...(occurrences?.topCountries.map((c) => c.count) ?? []));

  const habitatRows: { label: string; value: string; icon: LucideIcon }[] = habitat
    ? [
        { label: 'Native range', value: habitat.nativeRange, icon: Globe2 },
        { label: 'Habitat', value: habitat.habitat, icon: Leaf },
        { label: 'Season', value: habitat.season, icon: Sprout },
        { label: 'What to look for', value: habitat.whatToLookFor, icon: Compass },
      ]
    : [];

  return (
    <Page wide className="space-y-7">
      <PageHeader title="In the wild" subtitle={<span className="italic">{speciesName}</span>} onBack={onBack} />

      {error && (
        <Notice
          tone="danger"
          title="Couldn't load sightings"
          action={
            <Button size="sm" icon={RefreshCw} onClick={onRetry}>
              Retry
            </Button>
          }
        >
          {error}
        </Notice>
      )}

      {isLoading && (
        <Card>
          <LoadingState label="Searching GBIF for recorded sightings…" />
        </Card>
      )}

      {/* Cultivated houseplants routinely have zero wild records; this is the
          common case, not an edge case, and must never render a blank map. */}
      {!isLoading && noWildRecords && (
        <Notice icon={Sprout} title="No wild sightings on record">
          This plant is mostly grown in cultivation, so GBIF has no verified wild records. Its native range is
          described below.
        </Notice>
      )}

      {!isLoading && occurrences && !noWildRecords && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <MapView points={points} className="h-[420px] w-full overflow-hidden rounded-2xl border border-line" />
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Stat
                label="Sightings"
                value={occurrences.total.toLocaleString()}
                detail={`${occurrences.records.length} on the map`}
              />
              <Stat
                label="Nearest"
                value={occurrences.nearestKm === undefined ? '—' : `${Math.round(occurrences.nearestKm).toLocaleString()} km`}
                detail={occurrences.nearestKm === undefined ? 'Set a location in Nurseries' : 'from you'}
              />
            </div>
            {occurrences.topCountries.length > 0 && (
              <Card>
                <Eyebrow className="mb-3">Most sightings</Eyebrow>
                <ul className="space-y-2.5">
                  {occurrences.topCountries.map((c) => (
                    <li key={c.country} className="space-y-1">
                      <div className="flex justify-between text-[13px]">
                        <span className="truncate text-ink">{c.country}</span>
                        <span className="ml-3 shrink-0 tabular-nums text-muted">{c.count.toLocaleString()}</span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-sunken">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${(c.count / topMax) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      )}

      {habitat && (
        <div className="grid gap-4 sm:grid-cols-2">
          {habitatRows.map(({ label, value, icon: Icon }) => (
            <Card key={label}>
              <p className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold text-ink">
                <Icon size={15} className="text-accent" /> {label}
              </p>
              <p className="text-sm leading-relaxed text-muted">{value}</p>
            </Card>
          ))}
        </div>
      )}

      <Disclaimer>
        Sightings from GBIF. Range and habitat notes are written by AI. Never forage, eat or handle a wild plant on
        this basis alone.
      </Disclaimer>
    </Page>
  );
}
