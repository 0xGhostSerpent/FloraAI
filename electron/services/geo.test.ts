import { describe, expect, it } from 'vitest';
import { haversineKm } from './geo';

describe('haversineKm', () => {
  it('returns 0 for identical points', () => {
    expect(haversineKm({ lat: 23.8103, lon: 90.4125 }, { lat: 23.8103, lon: 90.4125 })).toBe(0);
  });

  it('measures Dhaka to Chattogram at roughly 214 km', () => {
    const d = haversineKm({ lat: 23.8103, lon: 90.4125 }, { lat: 22.3569, lon: 91.7832 });
    expect(d).toBeGreaterThan(205);
    expect(d).toBeLessThan(225);
  });

  it('measures antipodal points as half the circumference', () => {
    const d = haversineKm({ lat: 0, lon: 0 }, { lat: 0, lon: 180 });
    expect(d).toBeCloseTo(Math.PI * 6371, 0);
  });

  it('is symmetric', () => {
    const a = { lat: 51.5074, lon: -0.1278 };
    const b = { lat: 48.8566, lon: 2.3522 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 9);
  });
});
