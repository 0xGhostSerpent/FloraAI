import { describe, expect, it } from 'vitest';
import { isPriceCacheFresh, nurseryCacheKey, PRICE_TTL_MS, type PriceEstimate } from './store';

const estimate = (fetchedAt: number): PriceEstimate => ({
  scientificName: 'Monstera deliciosa',
  currency: 'BDT',
  small: { min: 300, max: 600 },
  medium: { min: 700, max: 1400 },
  large: { min: 1500, max: 3000 },
  note: 'Estimate',
  fetchedAt,
});

describe('isPriceCacheFresh', () => {
  const now = 1_800_000_000_000;

  it('accepts an estimate fetched just now', () => {
    expect(isPriceCacheFresh(estimate(now), now)).toBe(true);
  });

  it('accepts an estimate one minute inside the TTL', () => {
    expect(isPriceCacheFresh(estimate(now - PRICE_TTL_MS + 60_000), now)).toBe(true);
  });

  it('rejects an estimate one minute past the TTL', () => {
    expect(isPriceCacheFresh(estimate(now - PRICE_TTL_MS - 60_000), now)).toBe(false);
  });

  it('rejects an estimate with a future timestamp as untrustworthy', () => {
    expect(isPriceCacheFresh(estimate(now + 60_000), now)).toBe(false);
  });
});

describe('nurseryCacheKey', () => {
  it('rounds coordinates so a small movement reuses the same cached search', () => {
    expect(nurseryCacheKey(23.81034, 90.41252, 15)).toBe(nurseryCacheKey(23.8109, 90.4128, 15));
  });

  it('separates different radii', () => {
    expect(nurseryCacheKey(23.81, 90.41, 15)).not.toBe(nurseryCacheKey(23.81, 90.41, 30));
  });

  it('separates genuinely different places', () => {
    expect(nurseryCacheKey(23.81, 90.41, 15)).not.toBe(nurseryCacheKey(22.35, 91.78, 15));
  });
});
