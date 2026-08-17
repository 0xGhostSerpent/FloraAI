import { err, ok, Result } from './result';
import { isOnline } from './net';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const COMPLETE_TIMEOUT_MS = 60_000;
const LIST_TIMEOUT_MS = 15_000;

export type AiProviderId = 'gemini' | 'openai' | 'openrouter' | 'groq' | 'custom';

/** A provider-neutral message part. Images travel as base64, never as data URLs. */
export type AiPart = { text: string } | { image: { mimeType: string; data: string } };
export type AiTurn = { role: 'user' | 'assistant'; parts: AiPart[] };

export type AiTarget = {
  provider: AiProviderId;
  apiKey: string;
  /** Ignored for Gemini, which has a fixed endpoint. */
  baseUrl?: string;
};

export type CompleteRequest = AiTarget & {
  model: string;
  turns: AiTurn[];
  systemInstruction?: string;
  /** Ask for strict JSON. Gemini gets a schema; others get response_format. */
  json?: boolean;
  responseSchema?: unknown;
};

const isGemini = (provider: AiProviderId): boolean => provider === 'gemini';

/**
 * The renderer can pass a custom base URL, so this is a genuine SSRF boundary:
 * public HTTPS only, no loopback and no link-local metadata endpoints.
 */
function safeUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const host = url.hostname.toLowerCase();
  if (
    ['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(host) ||
    host.endsWith('.localhost') ||
    host === '169.254.169.254' ||
    /^(10|127)\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return null;
  }
  return url;
}

function authHeaders(target: AiTarget): Record<string, string> {
  // Gemini authenticates with its own header. Sending the key as ?key= would
  // put a live credential into URLs and any request log that sees them.
  return isGemini(target.provider)
    ? { 'x-goog-api-key': target.apiKey }
    : { Authorization: `Bearer ${target.apiKey}` };
}

/** Turns a transport or HTTP failure into a code the renderer can phrase. */
async function classify(response: Response): Promise<Result<never>> {
  const body = await response.text().catch(() => '');
  let detail = body.slice(0, 400);
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } | string };
    const message = typeof parsed.error === 'string' ? parsed.error : parsed.error?.message;
    if (message) detail = message;
  } catch {
    // Not JSON; the truncated body is the best detail available.
  }

  const { status } = response;
  if (status === 400 || status === 401) return err('AI_KEY_INVALID', detail);
  if (status === 403) return err('AI_KEY_FORBIDDEN', detail);
  if (status === 404) return err('AI_MODEL_NOT_FOUND', detail);
  if (status === 429) return err('AI_QUOTA', detail);
  if (status >= 500) return err('AI_PROVIDER_DOWN', detail);
  return err('AI_FAILED', detail || `HTTP ${status}`);
}

async function classifyThrown(cause: unknown): Promise<Result<never>> {
  if (cause instanceof Error && cause.name === 'TimeoutError') {
    return err('AI_TIMEOUT', 'The request took too long.');
  }
  // Distinguish "no internet" from "this key is wrong" instead of guessing.
  return (await isOnline())
    ? err('AI_NETWORK', cause instanceof Error ? cause.message : 'Network request failed.')
    : err('OFFLINE', 'No internet connection.');
}

async function request<T>(
  url: URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Result<T>> {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return classify(response);
    return ok((await response.json()) as T);
  } catch (cause) {
    return classifyThrown(cause);
  }
}

type GeminiModelList = { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> };
type OpenAiModelList = { data?: Array<{ id?: string }> };

/** Lists the models this key may actually use, so the UI never guesses. */
export async function listModels(target: AiTarget): Promise<Result<string[]>> {
  if (!target.apiKey) return err('NO_API_KEY', 'Enter and save an API key first.');

  if (isGemini(target.provider)) {
    const url = safeUrl(`${GEMINI_BASE}/models`);
    if (!url) return err('NO_ENDPOINT', 'Invalid Gemini endpoint.');
    const result = await request<GeminiModelList>(
      url,
      { method: 'GET', headers: authHeaders(target) },
      LIST_TIMEOUT_MS,
    );
    if (!result.ok) return result;
    const models = (result.data.models ?? [])
      .filter((model) => model.supportedGenerationMethods?.includes('generateContent'))
      .map((model) => model.name?.replace(/^models\//, ''))
      .filter((name): name is string => Boolean(name))
      .sort();
    return ok(models);
  }

  if (!target.baseUrl) return err('NO_ENDPOINT', 'Enter the provider API base URL first.');
  const url = safeUrl(`${target.baseUrl.replace(/\/$/, '')}/models`);
  if (!url) return err('NO_ENDPOINT', 'The base URL must be a public HTTPS address.');
  const result = await request<OpenAiModelList>(
    url,
    { method: 'GET', headers: authHeaders(target) },
    LIST_TIMEOUT_MS,
  );
  if (!result.ok) return result;
  return ok(
    (result.data.data ?? [])
      .map((item) => item.id)
      .filter((id): id is string => Boolean(id))
      .sort(),
  );
}

function geminiBody(req: CompleteRequest): unknown {
  const contents = req.turns.map((turn) => ({
    role: turn.role === 'assistant' ? 'model' : 'user',
    parts: turn.parts.map((part) =>
      'text' in part
        ? { text: part.text }
        : { inlineData: { mimeType: part.image.mimeType, data: part.image.data } },
    ),
  }));

  return {
    contents,
    ...(req.systemInstruction
      ? { systemInstruction: { parts: [{ text: req.systemInstruction }] } }
      : {}),
    ...(req.json
      ? {
          generationConfig: {
            responseMimeType: 'application/json',
            ...(req.responseSchema ? { responseSchema: req.responseSchema } : {}),
          },
        }
      : {}),
  };
}

function openAiBody(req: CompleteRequest): unknown {
  const messages: Array<Record<string, unknown>> = req.systemInstruction
    ? [{ role: 'system', content: req.systemInstruction }]
    : [];

  req.turns.forEach((turn, index) => {
    const isLastUserTurn = index === req.turns.length - 1 && turn.role === 'user';
    const hasImage = turn.parts.some((part) => 'image' in part);
    const text = turn.parts
      .filter((part): part is { text: string } => 'text' in part)
      .map((part) => part.text)
      .join('\n');
    // These providers honour response_format but still answer better with the
    // instruction spelled out; Gemini gets a real schema instead.
    const promptText = req.json && isLastUserTurn ? `${text}\nReturn valid JSON only.` : text;

    if (!hasImage) {
      messages.push({ role: turn.role, content: promptText });
      return;
    }

    const content: Array<Record<string, unknown>> = [{ type: 'text', text: promptText }];
    for (const part of turn.parts) {
      if ('image' in part) {
        content.push({
          type: 'image_url',
          image_url: { url: `data:${part.image.mimeType};base64,${part.image.data}` },
        });
      }
    }
    messages.push({ role: turn.role, content });
  });

  return {
    model: req.model,
    messages,
    ...(req.json ? { response_format: { type: 'json_object' } } : {}),
  };
}

type GeminiResponse = { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
type OpenAiResponse = { choices?: Array<{ message?: { content?: string } }> };

/** Returns the model's raw text; the renderer owns any JSON parsing. */
export async function complete(req: CompleteRequest): Promise<Result<string>> {
  if (!req.apiKey) return err('NO_API_KEY', 'Add your API key in Settings.');
  if (!req.model) return err('NO_MODEL', 'Choose a model in Settings.');

  if (isGemini(req.provider)) {
    const url = safeUrl(
      `${GEMINI_BASE}/models/${encodeURIComponent(req.model)}:generateContent`,
    );
    if (!url) return err('NO_ENDPOINT', 'Invalid Gemini endpoint.');
    const result = await request<GeminiResponse>(
      url,
      {
        method: 'POST',
        headers: { ...authHeaders(req), 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody(req)),
      },
      COMPLETE_TIMEOUT_MS,
    );
    if (!result.ok) return result;
    const text = result.data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim();
    return text ? ok(text) : err('AI_EMPTY', 'The model returned nothing.');
  }

  if (!req.baseUrl) return err('NO_ENDPOINT', 'Enter the provider API base URL in Settings.');
  const url = safeUrl(`${req.baseUrl.replace(/\/$/, '')}/chat/completions`);
  if (!url) return err('NO_ENDPOINT', 'The base URL must be a public HTTPS address.');
  const result = await request<OpenAiResponse>(
    url,
    {
      method: 'POST',
      headers: {
        ...authHeaders(req),
        'Content-Type': 'application/json',
        // OpenRouter attributes traffic with these and rate-limits anonymous
        // callers harder; harmless everywhere else.
        'HTTP-Referer': 'https://github.com/flora-ai',
        'X-Title': 'Flora AI',
      },
      body: JSON.stringify(openAiBody(req)),
    },
    COMPLETE_TIMEOUT_MS,
  );
  if (!result.ok) return result;
  const text = result.data.choices?.[0]?.message?.content?.trim();
  return text ? ok(text) : err('AI_EMPTY', 'The model returned nothing.');
}
