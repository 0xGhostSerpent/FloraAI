import { useState } from 'react';
import { Clock, Globe, MapPin, Navigation, Phone, Search, Store } from 'lucide-react';
import { motion } from 'motion/react';
import type { Nursery, PriceEstimate, UserLocation } from '../store';
import ErrorCard from '../components/ErrorCard';
import MapView, { type MapPoint } from '../components/MapView';

const RADII = [5, 15, 30, 50];

const AVAILABILITY_LABEL: Record<Nursery['availability'], string> = {
  likely: 'Likely stocked',
  call_ahead: 'Call ahead',
  unknown: 'Unknown',
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
};

const money = (currency: string, min: number, max: number) =>
  `${currency} ${Math.round(min).toLocaleString()}–${Math.round(max).toLocaleString()}`;

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
}: Props) {
  const [place, setPlace] = useState('');

  if (!location) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-6 pb-6 pt-2 space-y-5"
      >
        <div className="bg-bg-card dynamic-border rounded-[var(--radius-dynamic)] p-6 space-y-4">
          <div className="w-12 h-12 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center text-[var(--color-accent)]">
            <MapPin size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text-main">Where are you?</h2>
            <p className="text-sm text-text-muted leading-relaxed mt-1">
              Desktop computers have no GPS, so tell Flora AI your city or postcode to find nurseries
              near you. It is remembered and can be changed any time.
            </p>
          </div>

          <div className="flex gap-2">
            <input
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && place.trim() && onSubmitPlace(place.trim())}
              placeholder="Dhaka, Bangladesh"
              className="flex-1 bg-bg-main border border-text-muted/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--color-accent)] text-text-main"
            />
            <button
              onClick={() => place.trim() && onSubmitPlace(place.trim())}
              disabled={!place.trim() || isLoading}
              className="w-12 shrink-0 bg-[var(--color-accent)] disabled:opacity-50 rounded-xl flex items-center justify-center text-bg-main"
            >
              <Search size={18} />
            </button>
          </div>

          <button
            onClick={onUseIpLocation}
            disabled={isLoading}
            className="w-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/30 py-3 rounded-xl font-bold text-sm hover:bg-[var(--color-accent)]/20 transition-colors disabled:opacity-50"
          >
            Use my approximate location
          </button>

          {error && <ErrorCard message={error} />}
        </div>
      </motion.div>
    );
  }

  const points: MapPoint[] = [
    { lat: location.lat, lon: location.lon, label: 'You are here', accent: true },
    ...nurseries.map((n) => ({ lat: n.lat, lon: n.lon, label: n.name })),
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="px-6 pb-6 pt-2 space-y-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] text-[var(--color-accent)] font-bold uppercase tracking-widest">
            Searching near
          </p>
          <p className="text-sm font-bold text-text-main truncate">{location.label}</p>
        </div>
        <button
          onClick={onClearLocation}
          className="text-xs font-bold text-text-muted hover:text-text-main shrink-0 underline"
        >
          Change
        </button>
      </div>

      <div className="flex gap-2">
        {RADII.map((km) => (
          <button
            key={km}
            onClick={() => onChangeRadius(km)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
              radiusKm === km
                ? 'bg-[var(--color-accent)] text-bg-main'
                : 'bg-bg-card text-text-muted dynamic-border hover:text-text-main'
            }`}
          >
            {km} km
          </button>
        ))}
      </div>

      {speciesName && (
        <div className="bg-bg-card dynamic-border rounded-[var(--radius-dynamic)] p-5 space-y-3">
          <div>
            <p className="text-[10px] text-[var(--color-accent)] font-bold uppercase tracking-widest">
              Estimated price
            </p>
            <p className="text-sm font-bold text-text-main italic">{speciesName}</p>
          </div>

          {isPriceLoading ? (
            <p className="text-sm text-text-muted">Estimating…</p>
          ) : price ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                {(['small', 'medium', 'large'] as const).map((size) => (
                  <div key={size} className="bg-bg-main rounded-xl p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-text-muted font-bold">
                      {size}
                    </p>
                    <p className="text-xs font-bold text-text-main mt-1 leading-tight">
                      {money(price.currency, price[size].min, price[size].max)}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-text-muted leading-relaxed">{price.note}</p>
            </>
          ) : (
            <p className="text-sm text-text-muted">No estimate available.</p>
          )}

          <p className="text-[10px] text-text-muted opacity-80 font-medium">
            AI estimate — not a quote from any seller.
          </p>
        </div>
      )}

      {error && <ErrorCard message={error} onRetry={onRetry} />}

      {isStale && (
        <div className="bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 rounded-[var(--radius-dynamic)] px-4 py-3">
          <p className="text-xs text-text-main font-medium">
            You appear to be offline — showing last saved results.
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="bg-bg-card dynamic-border rounded-[var(--radius-dynamic)] p-8 flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-[var(--color-accent)]/30 border-t-[var(--color-accent)] rounded-full animate-spin" />
          <p className="text-sm text-text-muted font-medium">Searching nearby nurseries…</p>
        </div>
      ) : nurseries.length === 0 && !error ? (
        <div className="bg-bg-card dynamic-border rounded-[var(--radius-dynamic)] p-8 text-center space-y-3">
          <Store size={28} className="mx-auto text-text-muted" />
          <p className="text-sm text-text-muted font-medium">
            No nurseries found within {radiusKm} km. Try widening the search.
          </p>
        </div>
      ) : (
        <>
          <MapView points={points} center={{ lat: location.lat, lon: location.lon }} />

          <div className="space-y-3">
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">
              {nurseries.length} nearby
            </p>

            {nurseries.map((nursery) => (
              <div
                key={nursery.id}
                className="bg-bg-card dynamic-border rounded-[var(--radius-dynamic)] p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-text-main text-sm leading-tight">{nursery.name}</h3>
                    {nursery.address && (
                      <p className="text-xs text-text-muted mt-0.5 truncate">{nursery.address}</p>
                    )}
                  </div>
                  <span className="text-xs font-bold text-[var(--color-accent)] shrink-0">
                    {nursery.distanceKm.toFixed(1)} km
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                      nursery.availability === 'likely'
                        ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                        : 'bg-text-muted/10 text-text-muted'
                    }`}
                  >
                    {AVAILABILITY_LABEL[nursery.availability]}
                  </span>
                  {nursery.openingHours && (
                    <span className="text-[10px] text-text-muted flex items-center gap-1">
                      <Clock size={11} /> {nursery.openingHours}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      onOpenExternal(
                        `https://www.google.com/maps/search/?api=1&query=${nursery.lat},${nursery.lon}`,
                      )
                    }
                    className="flex-1 min-w-[8rem] bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/30 py-2 rounded-xl font-bold text-xs hover:bg-[var(--color-accent)]/20 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Navigation size={13} /> Open in Google Maps
                  </button>
                  {nursery.phone && (
                    <a
                      href={`tel:${nursery.phone}`}
                      className="bg-bg-main text-text-muted border border-text-muted/20 py-2 px-3 rounded-xl font-bold text-xs flex items-center gap-1.5 hover:text-text-main"
                    >
                      <Phone size={13} /> Call
                    </a>
                  )}
                  {nursery.website && (
                    <button
                      onClick={() => onOpenExternal(nursery.website!)}
                      className="bg-bg-main text-text-muted border border-text-muted/20 py-2 px-3 rounded-xl font-bold text-xs flex items-center gap-1.5 hover:text-text-main"
                    >
                      <Globe size={13} /> Website
                    </button>
                  )}
                </div>
              </div>
            ))}

            <p className="text-[10px] text-text-muted opacity-80 leading-relaxed text-center px-2">
              Availability not verified — call to confirm. Nursery data from OpenStreetMap.
            </p>
          </div>
        </>
      )}
    </motion.div>
  );
}
