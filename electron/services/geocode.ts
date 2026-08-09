import { err, ok, Result } from './result';
import { getJson } from './http';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const IPAPI = 'https://ipapi.co/json/';

export type UserLocation = {
  label: string;
  lat: number;
  lon: number;
  countryCode?: string;
  source: 'manual' | 'ip';
};

type NominatimHit = {
  lat: string;
  lon: string;
  display_name: string;
  address?: { country_code?: string };
};

/**
 * Forward geocode a city or postcode. Called only on explicit user action,
 * which keeps well inside Nominatim's one-request-per-second policy.
 */
export async function geocodeQuery(query: string): Promise<Result<UserLocation>> {
  const url = `${NOMINATIM}?${new URLSearchParams({
    q: query,
    format: 'json',
    limit: '1',
    addressdetails: '1',
    // Without this Nominatim localises display_name to the region's script,
    // which reads oddly beside the rest of the English interface.
    'accept-language': 'en',
  })}`;

  const response = await getJson<NominatimHit[]>(url);
  if (!response.ok) return response;

  // Nominatim signals "no match" with an empty array, not a 404.
  const hit = response.data[0];
  if (!hit) return err('GEOCODE_NONE', "Couldn't find that place. Try a city name.");

  return ok({
    label: hit.display_name,
    lat: Number(hit.lat),
    lon: Number(hit.lon),
    countryCode: hit.address?.country_code?.toUpperCase(),
    source: 'manual',
  });
}

type IpApiResponse = {
  latitude?: number;
  longitude?: number;
  city?: string;
  country_name?: string;
  country_code?: string;
  error?: boolean;
  reason?: string;
};

/** Coarse, city-level fallback. Desktops have no GPS. */
export async function locateByIp(): Promise<Result<UserLocation>> {
  const response = await getJson<IpApiResponse>(IPAPI);
  if (!response.ok) return response;

  const body = response.data;
  // ipapi.co reports its own errors with HTTP 200 and an `error` flag.
  if (body.error || typeof body.latitude !== 'number' || typeof body.longitude !== 'number') {
    return err('GEOCODE_NONE', "Couldn't determine your location. Enter a city instead.");
  }

  const label = [body.city, body.country_name].filter(Boolean).join(', ') || 'Approximate location';

  return ok({
    label,
    lat: body.latitude,
    lon: body.longitude,
    countryCode: body.country_code,
    source: 'ip',
  });
}
