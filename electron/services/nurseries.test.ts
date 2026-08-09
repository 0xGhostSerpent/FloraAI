import { describe, expect, it } from 'vitest';
import { availabilityFor, buildOverpassQuery, parseOverpass, type OverpassResponse } from './nurseries';

const origin = { lat: 23.8103, lon: 90.4125 };

const body: OverpassResponse = {
  elements: [
    {
      type: 'node',
      id: 1,
      lat: 23.81,
      lon: 90.41,
      tags: { shop: 'garden_centre', name: 'Green Thumb', 'addr:street': 'Mirpur Road', phone: '+880 2 111' },
    },
    {
      type: 'way',
      id: 2,
      center: { lat: 23.82, lon: 90.42 },
      tags: { shop: 'florist', name: 'Petal Co', 'contact:phone': '+880 2 222', 'contact:website': 'https://petal.test' },
    },
    { type: 'node', id: 3, lat: 23.83, lon: 90.43, tags: { shop: 'florist' } },
    { type: 'node', id: 4, tags: { shop: 'nursery', name: 'No Coords' } },
    {
      type: 'way',
      id: 5,
      center: { lat: 23.95, lon: 90.55 },
      tags: { landuse: 'plant_nursery', name: 'Far Farm' },
    },
  ],
};

describe('parseOverpass', () => {
  const results = parseOverpass(body, origin);

  it('reads coordinates from `center` for ways, which carry no lat/lon', () => {
    const petal = results.find((n) => n.name === 'Petal Co');
    expect(petal).toMatchObject({ lat: 23.82, lon: 90.42 });
  });

  it('drops elements with no name', () => {
    expect(results.find((n) => n.id === 'node/3')).toBeUndefined();
  });

  it('drops elements with no usable coordinates', () => {
    expect(results.find((n) => n.name === 'No Coords')).toBeUndefined();
  });

  it('sorts nearest first', () => {
    expect(results.map((n) => n.name)).toEqual(['Green Thumb', 'Petal Co', 'Far Farm']);
  });

  it('builds stable ids from type and id', () => {
    expect(results.map((n) => n.id)).toEqual(['node/1', 'way/2', 'way/5']);
  });

  it('maps landuse=plant_nursery to its own kind', () => {
    expect(results.find((n) => n.name === 'Far Farm')?.kind).toBe('plant_nursery');
  });

  it('assembles an address from the addr:* tags', () => {
    expect(results.find((n) => n.name === 'Green Thumb')?.address).toBe('Mirpur Road');
  });

  it('falls back to contact:phone and contact:website', () => {
    const petal = results.find((n) => n.name === 'Petal Co');
    expect(petal?.phone).toBe('+880 2 222');
    expect(petal?.website).toBe('https://petal.test');
  });

  it('computes a plausible distance from the origin', () => {
    const green = results.find((n) => n.name === 'Green Thumb');
    expect(green?.distanceKm).toBeLessThan(1);
  });

  it('returns an empty array for an empty response rather than throwing', () => {
    expect(parseOverpass({ elements: [] }, origin)).toEqual([]);
  });
});

describe('availabilityFor', () => {
  it('treats garden centres and nurseries as likely to stock plants', () => {
    expect(availabilityFor('garden_centre')).toBe('likely');
    expect(availabilityFor('nursery')).toBe('likely');
    expect(availabilityFor('plant_nursery')).toBe('likely');
  });

  it('tells the user to call ahead for florists', () => {
    expect(availabilityFor('florist')).toBe('call_ahead');
  });
});

describe('buildOverpassQuery', () => {
  const query = buildOverpassQuery(23.8103, 90.4125, 15000);

  it('requests `out center`, without which ways come back with no coordinates', () => {
    expect(query).toContain('out center tags;');
  });

  it('searches both shop tags and the plant_nursery landuse', () => {
    expect(query).toContain('garden_centre|florist|nursery');
    expect(query).toContain('"landuse"="plant_nursery"');
  });

  it('embeds the radius and origin', () => {
    expect(query).toContain('(around:15000,23.8103,90.4125)');
  });
});
