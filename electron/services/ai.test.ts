import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { complete, listModels } from './ai';
import { clearOnlineCache } from './net';

const PROBE_HOST = 'www.gstatic.com';

beforeEach(() => clearOnlineCache());
afterEach(() => vi.unstubAllGlobals());

type Call = { url: string; init: RequestInit };

/**
 * Answers the connectivity probe so a stubbed failure is classified as a real
 * failure rather than as "offline", and records the request under test.
 */
function stubFetch(respond: (url: string) => Response | Promise<Response>) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL, init: RequestInit = {}) => {
      const url = String(input);
      if (url.includes(PROBE_HOST)) return new Response(null, { status: 204 });
      calls.push({ url, init });
      return respond(url);
    }),
  );
  return calls;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const geminiOk = () =>
  json({ candidates: [{ content: { parts: [{ text: '{"name":"Fern"}' }] } }] });

const openAiOk = () => json({ choices: [{ message: { content: 'hello' } }] });

const headerOf = (call: Call, name: string): string | undefined =>
  (call.init.headers as Record<string, string> | undefined)?.[name];

describe('complete — Gemini transport', () => {
  it('authenticates with x-goog-api-key, keeping the key out of the URL', async () => {
    const calls = stubFetch(geminiOk);

    await complete({
      provider: 'gemini',
      apiKey: 'AIzaSyTOPSECRET',
      model: 'gemini-2.5-flash',
      turns: [{ role: 'user', parts: [{ text: 'hi' }] }],
    });

    expect(calls).toHaveLength(1);
    expect(headerOf(calls[0], 'x-goog-api-key')).toBe('AIzaSyTOPSECRET');
    // A key in the query string leaks into logs and crash reports.
    expect(calls[0].url).not.toContain('AIzaSyTOPSECRET');
    expect(calls[0].url).toContain('/models/gemini-2.5-flash:generateContent');
    expect(headerOf(calls[0], 'Authorization')).toBeUndefined();
  });

  it('maps an image part to inlineData and asks for a JSON schema', async () => {
    const calls = stubFetch(geminiOk);

    await complete({
      provider: 'gemini',
      apiKey: 'k',
      model: 'gemini-2.5-flash',
      json: true,
      responseSchema: { type: 'OBJECT' },
      turns: [
        {
          role: 'user',
          parts: [{ text: 'what plant' }, { image: { mimeType: 'image/png', data: 'BASE64' } }],
        },
      ],
    });

    const body = JSON.parse(calls[0].init.body as string);
    expect(body.contents[0].parts[1].inlineData).toEqual({
      mimeType: 'image/png',
      data: 'BASE64',
    });
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema).toEqual({ type: 'OBJECT' });
  });

  it('sends a system instruction in Gemini shape and renames the assistant role', async () => {
    const calls = stubFetch(geminiOk);

    await complete({
      provider: 'gemini',
      apiKey: 'k',
      model: 'gemini-2.5-flash',
      systemInstruction: 'You are a fern.',
      turns: [
        { role: 'user', parts: [{ text: 'hi' }] },
        { role: 'assistant', parts: [{ text: 'rustle' }] },
      ],
    });

    const body = JSON.parse(calls[0].init.body as string);
    expect(body.systemInstruction).toEqual({ parts: [{ text: 'You are a fern.' }] });
    expect(body.contents.map((turn: { role: string }) => turn.role)).toEqual(['user', 'model']);
  });

  it('returns the concatenated candidate text', async () => {
    stubFetch(geminiOk);

    const result = await complete({
      provider: 'gemini',
      apiKey: 'k',
      model: 'gemini-2.5-flash',
      turns: [{ role: 'user', parts: [{ text: 'hi' }] }],
    });

    expect(result).toEqual({ ok: true, data: '{"name":"Fern"}' });
  });
});

describe('complete — OpenAI-compatible transport', () => {
  it('uses bearer auth against the provider base URL', async () => {
    const calls = stubFetch(openAiOk);

    await complete({
      provider: 'groq',
      apiKey: 'gsk_abc',
      baseUrl: 'https://api.groq.com/openai/v1',
      model: 'llama-4-scout',
      turns: [{ role: 'user', parts: [{ text: 'hi' }] }],
    });

    expect(calls[0].url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(headerOf(calls[0], 'Authorization')).toBe('Bearer gsk_abc');
    expect(headerOf(calls[0], 'x-goog-api-key')).toBeUndefined();
  });

  it('sends an image as an image_url content part', async () => {
    const calls = stubFetch(openAiOk);

    await complete({
      provider: 'openai',
      apiKey: 'sk-x',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      json: true,
      turns: [
        {
          role: 'user',
          parts: [{ text: 'what plant' }, { image: { mimeType: 'image/jpeg', data: 'B64' } }],
        },
      ],
    });

    const body = JSON.parse(calls[0].init.body as string);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[0].content[1]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/jpeg;base64,B64' },
    });
    // These providers need the instruction spelled out; Gemini gets a schema.
    expect(body.messages[0].content[0].text).toContain('Return valid JSON only.');
  });

  it('puts a system instruction in a leading system message', async () => {
    const calls = stubFetch(openAiOk);

    await complete({
      provider: 'openai',
      apiKey: 'sk-x',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      systemInstruction: 'You are a fern.',
      turns: [{ role: 'user', parts: [{ text: 'hi' }] }],
    });

    const body = JSON.parse(calls[0].init.body as string);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'You are a fern.' });
    expect(body.messages[1].role).toBe('user');
  });

  it('trims the trailing slash off a custom base URL', async () => {
    const calls = stubFetch(openAiOk);

    await complete({
      provider: 'custom',
      apiKey: 'k',
      baseUrl: 'https://provider.example/v1/',
      model: 'm',
      turns: [{ role: 'user', parts: [{ text: 'hi' }] }],
    });

    expect(calls[0].url).toBe('https://provider.example/v1/chat/completions');
  });
});

describe('complete — guards', () => {
  it('rejects a missing key or model before making a request', async () => {
    const calls = stubFetch(openAiOk);
    const turns = [{ role: 'user' as const, parts: [{ text: 'hi' }] }];

    expect(
      await complete({ provider: 'gemini', apiKey: '', model: 'm', turns }),
    ).toMatchObject({ ok: false, error: { code: 'NO_API_KEY' } });
    expect(
      await complete({ provider: 'gemini', apiKey: 'k', model: '', turns }),
    ).toMatchObject({ ok: false, error: { code: 'NO_MODEL' } });
    expect(calls).toHaveLength(0);
  });

  it('requires a base URL for non-Gemini providers', async () => {
    stubFetch(openAiOk);

    expect(
      await complete({
        provider: 'custom',
        apiKey: 'k',
        baseUrl: '',
        model: 'm',
        turns: [{ role: 'user', parts: [{ text: 'hi' }] }],
      }),
    ).toMatchObject({ ok: false, error: { code: 'NO_ENDPOINT' } });
  });

  it.each([
    ['http://api.example.com/v1', 'plain HTTP'],
    ['https://localhost/v1', 'loopback by name'],
    ['https://127.0.0.1/v1', 'loopback by address'],
    ['https://169.254.169.254/v1', 'cloud metadata'],
    ['https://192.168.1.10/v1', 'private LAN'],
    ['https://10.0.0.5/v1', 'private range'],
    ['https://172.16.4.4/v1', 'private range'],
  ])('refuses %s (%s), since the base URL is user-supplied', async (baseUrl) => {
    const calls = stubFetch(openAiOk);

    const result = await complete({
      provider: 'custom',
      apiKey: 'k',
      baseUrl,
      model: 'm',
      turns: [{ role: 'user', parts: [{ text: 'hi' }] }],
    });

    expect(result).toMatchObject({ ok: false, error: { code: 'NO_ENDPOINT' } });
    expect(calls).toHaveLength(0);
  });

  it('treats an empty completion as a failure rather than empty success', async () => {
    stubFetch(() => json({ choices: [{ message: { content: '   ' } }] }));

    expect(
      await complete({
        provider: 'openai',
        apiKey: 'k',
        baseUrl: 'https://api.openai.com/v1',
        model: 'm',
        turns: [{ role: 'user', parts: [{ text: 'hi' }] }],
      }),
    ).toMatchObject({ ok: false, error: { code: 'AI_EMPTY' } });
  });
});

describe('complete — error classification', () => {
  it.each([
    [400, 'AI_KEY_INVALID'],
    [401, 'AI_KEY_INVALID'],
    [403, 'AI_KEY_FORBIDDEN'],
    [404, 'AI_MODEL_NOT_FOUND'],
    [429, 'AI_QUOTA'],
    [503, 'AI_PROVIDER_DOWN'],
    [418, 'AI_FAILED'],
  ])('maps HTTP %i to %s', async (status, code) => {
    stubFetch(() => json({ error: { message: 'upstream detail' } }, status));

    const result = await complete({
      provider: 'openai',
      apiKey: 'k',
      baseUrl: 'https://api.openai.com/v1',
      model: 'm',
      turns: [{ role: 'user', parts: [{ text: 'hi' }] }],
    });

    expect(result).toMatchObject({ ok: false, error: { code, message: 'upstream detail' } });
  });

  it('reports OFFLINE when even the probe cannot be reached', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );

    expect(
      await complete({
        provider: 'gemini',
        apiKey: 'k',
        model: 'gemini-2.5-flash',
        turns: [{ role: 'user', parts: [{ text: 'hi' }] }],
      }),
    ).toMatchObject({ ok: false, error: { code: 'OFFLINE' } });
  });

  it('reports AI_NETWORK when the machine is online but the provider is not', async () => {
    stubFetch(() => {
      throw new Error('provider unreachable');
    });

    expect(
      await complete({
        provider: 'gemini',
        apiKey: 'k',
        model: 'gemini-2.5-flash',
        turns: [{ role: 'user', parts: [{ text: 'hi' }] }],
      }),
    ).toMatchObject({ ok: false, error: { code: 'AI_NETWORK' } });
  });
});

describe('listModels', () => {
  it('keeps only Gemini models that can generate content, without the prefix', async () => {
    stubFetch(() =>
      json({
        models: [
          { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] },
          { name: 'models/gemini-2.0-flash', supportedGenerationMethods: ['generateContent'] },
        ],
      }),
    );

    expect(await listModels({ provider: 'gemini', apiKey: 'k' })).toEqual({
      ok: true,
      data: ['gemini-2.0-flash', 'gemini-2.5-flash'],
    });
  });

  it('reads OpenAI-compatible listings from data[].id, sorted', async () => {
    stubFetch(() => json({ data: [{ id: 'gpt-4o' }, { id: 'gpt-3.5-turbo' }, {}] }));

    expect(
      await listModels({
        provider: 'openai',
        apiKey: 'k',
        baseUrl: 'https://api.openai.com/v1',
      }),
    ).toEqual({ ok: true, data: ['gpt-3.5-turbo', 'gpt-4o'] });
  });

  it('refuses without a key rather than calling out', async () => {
    const calls = stubFetch(() => json({}));

    expect(await listModels({ provider: 'gemini', apiKey: '' })).toMatchObject({
      ok: false,
      error: { code: 'NO_API_KEY' },
    });
    expect(calls).toHaveLength(0);
  });
});
