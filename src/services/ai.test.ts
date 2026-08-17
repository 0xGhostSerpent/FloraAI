import { describe, expect, it } from 'vitest';
import {
  aiErrorMessage,
  baseUrlFor,
  detectProvider,
  pickVisionModel,
  providerName,
  supportsVision,
} from './ai';

describe('detectProvider', () => {
  it('recognises each provider from its key prefix', () => {
    expect(detectProvider('AIzaSyABCDEFGHIJKLMNOP')).toBe('gemini');
    expect(detectProvider('gsk_ABCDEFGHIJKLMNOP')).toBe('groq');
    expect(detectProvider('sk-proj-ABCDEFGHIJKLMNOP')).toBe('openai');
  });

  it('prefers OpenRouter over OpenAI, since both keys start with sk-', () => {
    expect(detectProvider('sk-or-v1-ABCDEFGHIJKLMNOP')).toBe('openrouter');
  });

  it('returns null rather than guessing at an unfamiliar key', () => {
    expect(detectProvider('')).toBeNull();
    expect(detectProvider('   ')).toBeNull();
    expect(detectProvider('some-internal-token-12345')).toBeNull();
  });

  it('ignores surrounding whitespace from a paste', () => {
    expect(detectProvider('  AIzaSyABCDEFGHIJKLMNOP  ')).toBe('gemini');
  });
});

describe('baseUrlFor', () => {
  it('falls back to the provider default', () => {
    expect(baseUrlFor({ apiKey: 'k', model: 'm', provider: 'groq' })).toBe(
      'https://api.groq.com/openai/v1',
    );
  });

  it('prefers an explicit base URL and strips its trailing slash', () => {
    expect(
      baseUrlFor({ apiKey: 'k', model: 'm', provider: 'custom', baseUrl: 'https://x.test/v1/' }),
    ).toBe('https://x.test/v1');
  });

  it('is empty for Gemini, which the main process routes itself', () => {
    expect(baseUrlFor({ apiKey: 'k', model: 'm', provider: 'gemini' })).toBe('');
  });
});

describe('pickVisionModel', () => {
  it('takes the first preferred model present in the live list', () => {
    const models = ['gemini-1.5-flash', 'gemini-2.5-flash', 'gemini-pro-vision'];
    expect(pickVisionModel(models, 'gemini')).toBe('gemini-2.5-flash');
  });

  it('falls back to any vision-capable model when no preference matches', () => {
    const models = ['gpt-3.5-turbo', 'gpt-4o-2024-11-20', 'text-embedding-3-small'];
    expect(pickVisionModel(models, 'openai')).toBe('gpt-4o-2024-11-20');
  });

  it('returns null instead of settling on a text-only model', () => {
    // The old code chose the alphabetically first entry, which broke photo
    // identification silently.
    expect(pickVisionModel(['gpt-3.5-turbo', 'davinci-002'], 'openai')).toBeNull();
  });

  it('keeps a current choice that is already valid', () => {
    const models = ['gpt-4o', 'gpt-4o-mini'];
    expect(pickVisionModel(models, 'openai', 'gpt-4o')).toBe('gpt-4o');
  });

  it('replaces a current choice the provider does not offer', () => {
    expect(pickVisionModel(['gpt-4o-mini'], 'openai', 'gemini-2.5-flash')).toBe('gpt-4o-mini');
  });

  it('replaces a current choice that cannot read images', () => {
    expect(pickVisionModel(['gpt-3.5-turbo', 'gpt-4o'], 'openai', 'gpt-3.5-turbo')).toBe('gpt-4o');
  });

  it('handles an empty list', () => {
    expect(pickVisionModel([], 'gemini')).toBeNull();
  });
});

describe('supportsVision', () => {
  it('accepts known vision families', () => {
    expect(supportsVision('gemini-2.5-flash', 'gemini')).toBe(true);
    expect(supportsVision('meta-llama/llama-4-scout-17b-16e-instruct', 'groq')).toBe(true);
    expect(supportsVision('google/gemini-2.5-flash', 'openrouter')).toBe(true);
  });

  it('flags text-only models', () => {
    expect(supportsVision('gpt-3.5-turbo', 'openai')).toBe(false);
    expect(supportsVision('llama-3.1-8b-instant', 'groq')).toBe(false);
  });

  it('assumes a custom endpoint is capable, since its models are unknown', () => {
    expect(supportsVision('whatever-1', 'custom')).toBe(true);
  });

  it('treats an unset model as nothing to warn about yet', () => {
    expect(supportsVision('', 'openai')).toBe(true);
  });
});

describe('aiErrorMessage', () => {
  it('names the provider that actually failed', () => {
    expect(aiErrorMessage('AI_KEY_INVALID', 'groq')).toContain('Groq');
    expect(aiErrorMessage('AI_QUOTA', 'openrouter')).toContain('OpenRouter');
    // The old copy blamed Gemini no matter which provider was selected.
    expect(aiErrorMessage('AI_KEY_INVALID', 'groq')).not.toContain('Gemini');
  });

  it('reports connectivity without blaming the key', () => {
    const message = aiErrorMessage('OFFLINE', 'openai');
    expect(message).toContain('offline');
    expect(message).not.toContain('key');
  });

  it('keeps the Gemini-specific referrer guidance for 403s', () => {
    expect(aiErrorMessage('AI_KEY_FORBIDDEN', 'gemini')).toContain('Generative Language API');
    expect(aiErrorMessage('AI_KEY_FORBIDDEN', 'openai')).not.toContain('Generative Language API');
  });

  it('surfaces the provider detail for unrecognised codes', () => {
    expect(aiErrorMessage('SOMETHING_NEW', 'openai', 'context length exceeded')).toContain(
      'context length exceeded',
    );
  });
});

describe('providerName', () => {
  it('falls back to the custom entry for an unknown id', () => {
    expect(providerName('gemini')).toBe('Google Gemini');
    // @ts-expect-error deliberately passing an id outside the union
    expect(providerName('nope')).toBe('Custom OpenAI-compatible');
  });
});
