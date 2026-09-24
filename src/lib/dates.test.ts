import { describe, expect, it } from 'vitest';
import { formatDateId, formatRelative, parseDateId } from './dates';

describe('parseDateId', () => {
  it('reads the unpadded ids the store writes', () => {
    const date = parseDateId('2026-9-4');
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(8);
    expect(date?.getDate()).toBe(4);
  });

  it('orders ids by date, which string comparison does not', () => {
    expect('2026-10-1' < '2026-9-30').toBe(true);
    expect(parseDateId('2026-10-1')!.getTime()).toBeGreaterThan(parseDateId('2026-9-30')!.getTime());
  });

  it('rejects anything that is not a date id', () => {
    expect(parseDateId('yesterday')).toBeNull();
  });
});

describe('formatDateId', () => {
  const now = new Date(2026, 8, 24, 10);

  it('names today and yesterday', () => {
    expect(formatDateId('2026-9-24', now)).toBe('Today');
    expect(formatDateId('2026-9-23', now)).toBe('Yesterday');
  });

  it('falls back to the raw id when it cannot parse', () => {
    expect(formatDateId('not-a-date', now)).toBe('not-a-date');
  });
});

describe('formatRelative', () => {
  const now = 1_800_000_000_000;

  it('rounds to the coarsest useful unit', () => {
    expect(formatRelative(now - 10_000, now)).toBe('just now');
    expect(formatRelative(now - 5 * 60_000, now)).toBe('5 min ago');
    expect(formatRelative(now - 3 * 3_600_000, now)).toBe('3 h ago');
    expect(formatRelative(now - 86_400_000, now)).toBe('yesterday');
    expect(formatRelative(now - 3 * 86_400_000, now)).toBe('3 days ago');
  });
});
