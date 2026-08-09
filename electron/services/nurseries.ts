import { err, ok, Result } from './result';
import { postForm } from './http';
import { haversineKm, type Coord } from './geo';

const ENDPOINT = 'https://overpass-api.de/api/interpreter';
const SHOP_TAGS = 'garden_centre|florist|nursery';

export type NurseryKind = 'garden_centre' | 'nursery' | 'plant_nursery' | 'florist';
export type Availability = 'likely' | 'call_ahead' | 'unknown';

export type Nursery = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  distanceKm: number;
  address?: string;
  phone?: string;
  website?: string;
  openingHours?: string;
  kind: NurseryKind;
  availability: Availability;
};

type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export type OverpassResponse = { elements: OverpassElement[] };

export function buildOverpassQuery(lat: number, lon: number, radiusMeters: number): string {
  const around = `(around:${radiusMeters},${lat},${lon})`;
  return `[out:json][timeout:25];
(
  node["shop"~"${SHOP_TAGS}"]${around};
  way["shop"~"${SHOP_TAGS}"]${around};
  node["landuse"="plant_nursery"]${around};
  way["landuse"="plant_nursery"]${around};
);
out center tags;`;
}

/**
 * OpenStreetMap carries no stock data, so this is derived from the tag alone
 * and is never presented as verified inventory.
 */
export function availabilityFor(kind: NurseryKind): Availability {
  return kind === 'florist' ? 'call_ahead' : 'likely';
}

function kindFor(tags: Record<string, string>): NurseryKind | null {
  const shop = tags.shop;
  if (shop === 'garden_centre' || shop === 'nursery' || shop === 'florist') return shop;
  if (tags.landuse === 'plant_nursery') return 'plant_nursery';
  return null;
}

function addressFrom(tags: Record<string, string>): string | undefined {
  const joined = [tags['addr:housenumber'], tags['addr:street'], tags['addr:city'], tags['addr:postcode']]
    .filter(Boolean)
    .join(' ')
    .trim();
  return joined || undefined;
}

export function parseOverpass(body: OverpassResponse, origin: Coord): Nursery[] {
  const results: Nursery[] = [];

  for (const element of body.elements ?? []) {
    const tags = element.tags;
    if (!tags?.name) continue; // An unnamed pin is useless to the user.

    // Ways carry no lat/lon of their own; `out center` supplies a centroid.
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;

    const kind = kindFor(tags);
    if (!kind) continue;

    results.push({
      id: `${element.type}/${element.id}`,
      name: tags.name,
      lat,
      lon,
      distanceKm: haversineKm(origin, { lat, lon }),
      address: addressFrom(tags),
      phone: tags.phone ?? tags['contact:phone'],
      website: tags.website ?? tags['contact:website'],
      openingHours: tags.opening_hours,
      kind,
      availability: availabilityFor(kind),
    });
  }

  return results.sort((a, b) => a.distanceKm - b.distanceKm);
}

export async function findNurseries(opts: {
  lat: number;
  lon: number;
  radiusKm: number;
}): Promise<Result<Nursery[]>> {
  const query = buildOverpassQuery(opts.lat, opts.lon, Math.round(opts.radiusKm * 1000));
  const response = await postForm<OverpassResponse>(ENDPOINT, { data: query });

  if (!response.ok) {
    const { code } = response.error;
    if (code === 'HTTP_429' || code === 'HTTP_504') {
      return err('OVERPASS_BUSY', 'Nursery service is busy. Try again in a moment.');
    }
    if (code === 'TIMEOUT') {
      return err('OVERPASS_TIMEOUT', 'Search took too long. Try a smaller radius.');
    }
    return response;
  }

  // An empty list is a success; the screen decides how to phrase "nothing nearby".
  return ok(parseOverpass(response.data, { lat: opts.lat, lon: opts.lon }));
}
