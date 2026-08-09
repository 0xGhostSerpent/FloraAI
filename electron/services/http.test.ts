import { afterEach, describe, expect, it, vi } from 'vitest';
import { getJson } from './http';

afterEach(() => vi.unstubAllGlobals());

describe('getJson', () => {
  it('returns ok with the parsed body on 200', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"hello":"world"}', { status: 200 })));

    const result = await getJson<{ hello: string }>('https://example.test/x');

    expect(result).toEqual({ ok: true, data: { hello: 'world' } });
  });

  it('returns an error result on a non-200 rather than throwing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 429 })));

    const result = await getJson('https://example.test/x');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('HTTP_429');
  });

  it('returns an error result when fetch rejects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );

    const result = await getJson('https://example.test/x');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NETWORK');
  });

  it('reports a timeout distinctly from a generic network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const e = new Error('timed out');
        e.name = 'TimeoutError';
        throw e;
      }),
    );

    const result = await getJson('https://example.test/x');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TIMEOUT');
  });

  it('sends the Flora AI User-Agent, which Nominatim requires', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await getJson('https://example.test/x');

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['User-Agent']).toContain('FloraAI');
  });
});
