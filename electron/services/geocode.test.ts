import { afterEach, describe, expect, it, vi } from 'vitest';
import { geocodeQuery, locateByIp } from './geocode';

afterEach(() => vi.unstubAllGlobals());

const stubJson = (body: unknown, status = 200) =>
  vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status }));

describe('geocodeQuery', () => {
  it('maps a Nominatim hit, converting its string coordinates to numbers', async () => {
    vi.stubGlobal(
      'fetch',
      stubJson([
        {
          lat: '23.8103',
          lon: '90.4125',
          display_name: 'Dhaka, Bangladesh',
          address: { country_code: 'bd' },
        },
      ]),
    );

    expect(await geocodeQuery('Dhaka')).toEqual({
      ok: true,
      data: {
        label: 'Dhaka, Bangladesh',
        lat: 23.8103,
        lon: 90.4125,
        countryCode: 'BD',
        source: 'manual',
      },
    });
  });

  it('treats an empty array as a miss — Nominatim returns [] rather than a 404', async () => {
    vi.stubGlobal('fetch', stubJson([]));

    expect(await geocodeQuery('asdkjhasd')).toMatchObject({
      ok: false,
      error: { code: 'GEOCODE_NONE' },
    });
  });

  it('requests a single JSON result with address details', async () => {
    const fetchMock = stubJson([]);
    vi.stubGlobal('fetch', fetchMock);

    await geocodeQuery('Dhaka');

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get('format')).toBe('json');
    expect(url.searchParams.get('limit')).toBe('1');
    expect(url.searchParams.get('addressdetails')).toBe('1');
    expect(url.searchParams.get('q')).toBe('Dhaka');
  });

  it('propagates a transport failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );

    expect(await geocodeQuery('Dhaka')).toMatchObject({ ok: false, error: { code: 'NETWORK' } });
  });
});

describe('locateByIp', () => {
  it('maps an ipapi.co response and marks the source as ip', async () => {
    vi.stubGlobal(
      'fetch',
      stubJson({
        latitude: 23.7,
        longitude: 90.4,
        city: 'Dhaka',
        country_name: 'Bangladesh',
        country_code: 'BD',
      }),
    );

    expect(await locateByIp()).toEqual({
      ok: true,
      data: {
        label: 'Dhaka, Bangladesh',
        lat: 23.7,
        lon: 90.4,
        countryCode: 'BD',
        source: 'ip',
      },
    });
  });

  it('rejects the ipapi.co error body, which arrives with HTTP 200', async () => {
    vi.stubGlobal('fetch', stubJson({ error: true, reason: 'RateLimited' }));

    expect(await locateByIp()).toMatchObject({ ok: false, error: { code: 'GEOCODE_NONE' } });
  });

  it('rejects a response missing coordinates', async () => {
    vi.stubGlobal('fetch', stubJson({ city: 'Nowhere' }));

    expect(await locateByIp()).toMatchObject({ ok: false, error: { code: 'GEOCODE_NONE' } });
  });
});
