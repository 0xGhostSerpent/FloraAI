import { useState } from 'react';
import { Clock, Globe, LocateFixed, MapPin, Navigation, Phone, RefreshCw, Search, Store } from 'lucide-react';
import type { Nursery, PriceEstimate, UserLocation } from '../store';
import MapView, { type MapPoint } from '../components/MapView';
import {
  Badge,
  Button,
  Card,
  Disclaimer,
  EmptyState,
  Eyebrow,
  Input,
  LoadingState,
  Notice,
  Page,
  PageHeader,
  Segmented,
  Spinner,
} from '../components/ui';

const RADII = [5, 15, 30, 50];

const AVAILABILITY: Record<Nursery['availability'], { label: string; tone: 'accent' | 'neutral' }> = {
  likely: { label: 'Likely stocked', tone: 'accent' },
  call_ahead: { label: 'Call ahead', tone: 'neutral' },
  unknown: { label: 'Stock unknown', tone: 'neutral' },
};

type Props = {
  speciesName: string | null;
  location: UserLocation | null;
  nurseries: Nursery[];
  price: PriceEstimate | null;
  radiusKm: number;
  isLoading: boolean;
  isPriceLoading: boolean;
  error: string | null;
  isStale: boolean;
  onSubmitPlace: (query: string) => void;
  onUseIpLocation: () => void;
  onChangeRadius: (km: number) => void;
  onClearLocation: () => void;
  onRetry: () => void;
  onOpenExternal: (url: string) => void;
  onBack?: () => void;
};

const money = (currency: string, min: number, max: number) =>
  `${currency} ${Math.round(min).toLocaleString()}–${Math.round(max).toLocaleString()}`;

function LocationPrompt({
  isLoading,
  error,
  onSubmitPlace,
  onUseIpLocation,
}: Pick<Props, 'isLoading' | 'error' | 'onSubmitPlace' | 'onUseIpLocation'>) {
  const [place, setPlace] = useState('');
  const submit = () => place.trim() && onSubmitPlace(place.trim());

  return (
    <Card className="max-w-lg space-y-5 p-7">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <MapPin size={20} />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-ink">Where should we look?</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Enter a city, area or postcode. Flora remembers it, and you can change it any time.
        </p>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="e.g. Dhanmondi, Dhaka" autoFocus />
        <Button type="submit" variant="primary" icon={Search} disabled={!place.trim()} loading={isLoading}>
          Search
        </Button>
      </form>
      <div className="flex items-center gap-3 text-xs text-faint">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>
      <Button block icon={LocateFixed} onClick={onUseIpLocation} disabled={isLoading}>
        Use my approximate location
      </Button>
      {error && <Notice tone="danger">{error}</Notice>}
    </Card>
  );
}

function NurseryRow({ nursery, onOpenExternal }: { nursery: Nursery; onOpenExternal: (url: string) => void }) {
  const availability = AVAILABILITY[nursery.availability];
  return (
    <li className="space-y-3 px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{nursery.name}</h3>
          {nursery.address && <p className="mt-0.5 truncate text-[13px] text-muted">{nursery.address}</p>}
        </div>
        <span className="shrink-0 text-[13px] font-medium tabular-nums text-muted">{nursery.distanceKm.toFixed(1)} km</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Badge tone={availability.tone}>{availability.label}</Badge>
        {nursery.openingHours && (
          <span className="inline-flex items-center gap-1 text-xs text-muted">
            <Clock size={12} /> {nursery.openingHours}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          icon={Navigation}
          onClick={() => onOpenExternal(`https://www.google.com/maps/search/?api=1&query=${nursery.lat},${nursery.lon}`)}
        >
          Directions
        </Button>
        {nursery.phone && (
          <a
            href={`tel:${nursery.phone}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold text-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            <Phone size={14} /> {nursery.phone}
          </a>
        )}
        {nursery.website && (
          <Button size="sm" variant="ghost" icon={Globe} onClick={() => onOpenExternal(nursery.website!)}>
            Website
          </Button>
        )}
      </div>
    </li>
  );
}

export default function NurseryScreen({
  speciesName,
  location,
  nurseries,
  price,
  radiusKm,
  isLoading,
  isPriceLoading,
  error,
  isStale,
  onSubmitPlace,
  onUseIpLocation,
  onChangeRadius,
  onClearLocation,
  onRetry,
  onOpenExternal,
  onBack,
}: Props) {
  const header = (
    <PageHeader
      title="Where to buy"
      subtitle={speciesName ? <span className="italic">{speciesName}</span> : 'Plant nurseries, garden centres and florists near you'}
      onBack={onBack}
    />
  );

  if (!location) {
    return (
      <Page wide className="space-y-7">
        {header}
        <LocationPrompt isLoading={isLoading} error={error} onSubmitPlace={onSubmitPlace} onUseIpLocation={onUseIpLocation} />
      </Page>
    );
  }

  const points: MapPoint[] = [
    { lat: location.lat, lon: location.lon, label: 'You', accent: true },
    ...nurseries.map((n) => ({ lat: n.lat, lon: n.lon, label: n.name })),
  ];

  return (
    <Page wide className="space-y-6">
      {header}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <MapPin size={16} className="shrink-0 text-muted" />
          <span className="truncate font-medium text-ink">{location.label}</span>
          <Button size="sm" variant="ghost" onClick={onClearLocation}>
            Change
          </Button>
        </div>
        <Segmented
          label="Search radius"
          value={radiusKm}
          onChange={onChangeRadius}
          options={RADII.map((km) => ({ value: km, label: `${km} km` }))}
        />
      </div>

      {isStale && (
        <Notice tone="warn" title="Showing saved results">
          The search couldn't reach OpenStreetMap, so these are from your last search here.
        </Notice>
      )}
      {error && (
        <Notice
          tone="danger"
          title="Search failed"
          action={
            <Button size="sm" icon={RefreshCw} onClick={onRetry}>
              Retry
            </Button>
          }
        >
          {error}
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {speciesName && (
            <Card>
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <Eyebrow>Typical price</Eyebrow>
                <span className="text-xs text-faint">AI estimate, not a quote</span>
              </div>
              {isPriceLoading ? (
                <p className="flex items-center gap-2 text-sm text-muted">
                  <Spinner size={14} /> Estimating local prices…
                </p>
              ) : price ? (
                <>
                  <dl className="grid grid-cols-3 divide-x divide-line">
                    {(['small', 'medium', 'large'] as const).map((size) => (
                      <div key={size} className="px-3 first:pl-0 last:pr-0">
                        <dt className="text-xs capitalize text-muted">{size}</dt>
                        <dd className="mt-1 text-sm font-semibold tabular-nums text-ink">
                          {money(price.currency, price[size].min, price[size].max)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {price.note && <p className="mt-4 text-[13px] leading-relaxed text-muted">{price.note}</p>}
                </>
              ) : (
                <p className="text-sm text-muted">No estimate available for this plant.</p>
              )}
            </Card>
          )}

          <MapView
            points={points}
            center={{ lat: location.lat, lon: location.lon }}
            className="h-80 w-full overflow-hidden rounded-2xl border border-line lg:h-[420px]"
          />
        </div>

        <Card padded={false} className="self-start">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <p className="text-sm font-semibold text-ink">
              {isLoading ? 'Searching…' : `${nurseries.length} within ${radiusKm} km`}
            </p>
          </div>
          {isLoading ? (
            <LoadingState label="Searching OpenStreetMap…" />
          ) : nurseries.length === 0 ? (
            <EmptyState
              icon={Store}
              title="Nothing found nearby"
              action={
                radiusKm < RADII[RADII.length - 1] && (
                  <Button size="sm" onClick={() => onChangeRadius(RADII[RADII.indexOf(radiusKm) + 1] ?? 50)}>
                    Search further
                  </Button>
                )
              }
            >
              No nurseries or garden centres are mapped within {radiusKm} km.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {nurseries.map((nursery) => (
                <NurseryRow key={nursery.id} nursery={nursery} onOpenExternal={onOpenExternal} />
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Disclaimer>
        Stock is never confirmed: garden centres are marked likely to carry common plants, florists call-ahead. Call
        before you go. Nursery data © OpenStreetMap contributors.
      </Disclaimer>
    </Page>
  );
}
