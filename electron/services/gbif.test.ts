import { afterEach, describe, expect, it, vi } from 'vitest';
import { matchSpecies, parseOccurrences, type OccurrenceResponse } from './gbif';

afterEach(() => vi.unstubAllGlobals());

const body: OccurrenceResponse = {
  count: 4821,
  results: [
    { decimalLatitude: 10, decimalLongitude: 20, country: 'Mexico', countryCode: 'MX', year: 2019, basisOfRecord: 'HUMAN_OBSERVATION' },
    { decimalLatitude: 11, decimalLongitude: 21, country: 'Mexico', countryCode: 'MX', year: 2020, basisOfRecord: 'OBSERVATION' },
    { decimalLatitude: 12, decimalLongitude: 22, country: 'Belize', countryCode: 'BZ', year: 2021, basisOfRecord: 'MACHINE_OBSERVATION' },
    { decimalLatitude: 13, decimalLongitude: 23, country: 'Kew', countryCode: 'GB', year: 2021, basisOfRecord: 'LIVING_SPECIMEN' },
    { decimalLatitude: 14, decimalLongitude: 24, country: 'France', countryCode: 'FR', year: 1901, basisOfRecord: 'PRESERVED_SPECIMEN' },
    { decimalLatitude: null, decimalLongitude: null, country: 'Nowhere', basisOfRecord: 'HUMAN_OBSERVATION' },
  ],
};

describe('parseOccurrences', () => {
  const set = parseOccurrences(body);

  it('keeps genuine observation records', () => {
    expect(set.records).toHaveLength(3);
  });

  it('excludes LIVING_SPECIMEN, which is botanical-garden stock rather than wild', () => {
    expect(set.records.some((r) => r.basisOfRecord === 'LIVING_SPECIMEN')).toBe(false);
  });

  it('excludes PRESERVED_SPECIMEN herbarium records', () => {
    expect(set.records.some((r) => r.basisOfRecord === 'PRESERVED_SPECIMEN')).toBe(false);
  });

  it('drops records with no coordinates', () => {
    expect(set.records.some((r) => r.country === 'Nowhere')).toBe(false);
  });

  it('reports GBIF total count, not the page size', () => {
    expect(set.total).toBe(4821);
    expect(set.total).not.toBe(set.records.length);
  });

  it('aggregates top countries in descending order', () => {
    expect(set.topCountries).toEqual([
      { country: 'Mexico', count: 2 },
      { country: 'Belize', count: 1 },
    ]);
  });

  it('reports the nearest sighting when an origin is supplied', () => {
    const withOrigin = parseOccurrences(body, { lat: 10, lon: 20 });
    expect(withOrigin.nearestKm).toBeCloseTo(0, 5);
  });

  it('omits nearestKm when no origin is supplied', () => {
    expect(set.nearestKm).toBeUndefined();
  });

  it('handles an empty result set without throwing', () => {
    expect(parseOccurrences({ count: 0, results: [] })).toEqual({
      total: 0,
      records: [],
      topCountries: [],
    });
  });
});

describe('matchSpecies', () => {
  it('maps a successful match', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              usageKey: 2872898,
              scientificName: 'Monstera deliciosa Liebm.',
              rank: 'SPECIES',
              family: 'Araceae',
              confidence: 97,
              matchType: 'EXACT',
            }),
            { status: 200 },
          ),
      ),
    );

    expect(await matchSpecies('Monstera deliciosa')).toEqual({
      ok: true,
      data: {
        usageKey: 2872898,
        scientificName: 'Monstera deliciosa Liebm.',
        rank: 'SPECIES',
        family: 'Araceae',
        matchConfidence: 97,
      },
    });
  });

  it('treats matchType NONE as a miss — GBIF signals it with HTTP 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ matchType: 'NONE', confidence: 0 }), { status: 200 })),
    );

    expect(await matchSpecies('Notaplant fakeus')).toMatchObject({
      ok: false,
      error: { code: 'SPECIES_NO_MATCH' },
    });
  });
});
