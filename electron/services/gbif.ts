import { err, ok, Result } from './result';
import { getJson } from './http';
import { haversineKm, type Coord } from './geo';

const MATCH_ENDPOINT = 'https://api.gbif.org/v1/species/match';
const OCCURRENCE_ENDPOINT = 'https://api.gbif.org/v1/occurrence/search';
const PAGE_LIMIT = 300;

/**
 * "In the wild" means observed in nature. LIVING_SPECIMEN is overwhelmingly
 * botanical-garden accessions and PRESERVED_SPECIMEN is herbarium material —
 * both are the opposite of what this screen claims to show.
 */
const WILD_BASIS = new Set(['HUMAN_OBSERVATION', 'OBSERVATION', 'MACHINE_OBSERVATION']);

export type SpeciesMatch = {
  usageKey: number;
  scientificName: string;
  rank: string;
  family?: string;
  matchConfidence: number;
};

export type Occurrence = {
  lat: number;
  lon: number;
  country?: string;
  countryCode?: string;
  year?: number;
  basisOfRecord: string;
};

export type OccurrenceSet = {
  total: number;
  records: Occurrence[];
  topCountries: { country: string; count: number }[];
  nearestKm?: number;
};

type MatchResponse = {
  usageKey?: number;
  scientificName?: string;
  rank?: string;
  family?: string;
  confidence?: number;
  matchType?: string;
};

type OccurrenceRecord = {
  decimalLatitude?: number | null;
  decimalLongitude?: number | null;
  country?: string;
  countryCode?: string;
  year?: number;
  basisOfRecord?: string;
};

export type OccurrenceResponse = { count: number; results: OccurrenceRecord[] };

export async function matchSpecies(scientificName: string): Promise<Result<SpeciesMatch>> {
  const url = `${MATCH_ENDPOINT}?${new URLSearchParams({ name: scientificName })}`;
  const response = await getJson<MatchResponse>(url);
  if (!response.ok) return response;

  const body = response.data;
  // GBIF reports a miss with HTTP 200 and matchType NONE.
  if (body.matchType === 'NONE' || !body.usageKey) {
    return err('SPECIES_NO_MATCH', 'No match for this species in the GBIF backbone.');
  }

  return ok({
    usageKey: body.usageKey,
    scientificName: body.scientificName ?? scientificName,
    rank: body.rank ?? 'UNKNOWN',
    family: body.family,
    matchConfidence: body.confidence ?? 0,
  });
}

export function parseOccurrences(body: OccurrenceResponse, origin?: Coord): OccurrenceSet {
  const records: Occurrence[] = [];

  for (const raw of body.results ?? []) {
    const basisOfRecord = raw.basisOfRecord ?? '';
    if (!WILD_BASIS.has(basisOfRecord)) continue;
    if (typeof raw.decimalLatitude !== 'number' || typeof raw.decimalLongitude !== 'number') continue;

    records.push({
      lat: raw.decimalLatitude,
      lon: raw.decimalLongitude,
      country: raw.country,
      countryCode: raw.countryCode,
      year: raw.year,
      basisOfRecord,
    });
  }

  const counts = new Map<string, number>();
  for (const record of records) {
    if (!record.country) continue;
    counts.set(record.country, (counts.get(record.country) ?? 0) + 1);
  }

  const topCountries = [...counts.entries()]
    .map(([country, count]) => ({ country, count }))
    // Alphabetical tie-break keeps the order deterministic.
    .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country))
    .slice(0, 5);

  const nearestKm =
    origin && records.length
      ? Math.min(...records.map((r) => haversineKm(origin, { lat: r.lat, lon: r.lon })))
      : undefined;

  return { total: body.count ?? records.length, records, topCountries, nearestKm };
}

export async function findOccurrences(
  taxonKey: number,
  origin?: Coord,
): Promise<Result<OccurrenceSet>> {
  const url = `${OCCURRENCE_ENDPOINT}?${new URLSearchParams({
    taxonKey: String(taxonKey),
    hasCoordinate: 'true',
    hasGeospatialIssue: 'false',
    limit: String(PAGE_LIMIT),
  })}`;

  const response = await getJson<OccurrenceResponse>(url);
  if (!response.ok) return response;

  return ok(parseOccurrences(response.data, origin));
}
