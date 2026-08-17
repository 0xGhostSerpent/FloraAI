export type FloraResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

import type { Nursery, OccurrenceSet, SpeciesMatch, UserLocation } from '../store';

export type GoogleTokens = { idToken: string; accessToken: string };

/**
 * 'os'    - encrypted by the OS keychain.
 * 'basic' - Chromium's obfuscation fallback, used when no keyring exists.
 */
export type StorageBackend = 'os' | 'basic';

export type AiProviderId = 'gemini' | 'openai' | 'openrouter' | 'groq' | 'custom';

/** Provider-neutral message parts. Images travel as base64, not data URLs. */
export type AiPart = { text: string } | { image: { mimeType: string; data: string } };
export type AiTurn = { role: 'user' | 'assistant'; parts: AiPart[] };

export type AiTarget = {
  provider: AiProviderId;
  apiKey: string;
  /** Ignored for Gemini, which has a fixed endpoint. */
  baseUrl?: string;
};

export type AiCompleteRequest = AiTarget & {
  model: string;
  turns: AiTurn[];
  systemInstruction?: string;
  json?: boolean;
  responseSchema?: unknown;
};

export type FloraApi = {
  openExternal(url: string): Promise<void>;
  secrets: {
    get(name: string): Promise<string | null>;
    /** Resolves false only when no storage backend exists at all. */
    set(name: string, value: string): Promise<boolean>;
    clear(name: string): Promise<void>;
    /** Lets Settings state plainly how the key is protected. */
    backend(): Promise<StorageBackend>;
  };
  auth: {
    /** Runs the PKCE loopback: consent happens in the system browser. */
    signIn(): Promise<FloraResult<GoogleTokens>>;
    /** False when electron/oauth-config.json is absent or unfilled. */
    isConfigured(): Promise<boolean>;
    clearTokens(): Promise<void>;
  };
  drive: {
    syncBackup(payload: unknown): Promise<FloraResult<{ success: boolean; syncedAt: number; fileId?: string }>>;
    getLastSync(): Promise<{ syncedAt: number | null }>;
  };
  /**
   * Every provider is called from the main process, so the renderer CSP needs
   * no AI hosts and a custom base URL works in packaged builds.
   */
  ai: {
    /** Resolves the model's raw text; the caller owns any JSON parsing. */
    complete(req: AiCompleteRequest): Promise<FloraResult<string>>;
    listModels(target: AiTarget): Promise<FloraResult<string[]>>;
  };
  net: {
    /** Forces a fresh probe rather than reading a cached verdict. */
    status(): Promise<boolean>;
    onChange(handler: (online: boolean) => void): () => void;
  };
  /** Nominatim forward geocode. Called only on explicit user action. */
  geocode(query: string): Promise<FloraResult<UserLocation>>;
  /** Coarse IP fallback — desktops have no GPS. */
  locateByIp(): Promise<FloraResult<UserLocation>>;
  findNurseries(opts: {
    lat: number;
    lon: number;
    radiusKm: number;
  }): Promise<FloraResult<Nursery[]>>;
  gbifMatch(name: string): Promise<FloraResult<SpeciesMatch>>;
  gbifOccurrences(
    taxonKey: number,
    origin?: { lat: number; lon: number },
  ): Promise<FloraResult<OccurrenceSet>>;
};

declare global {
  interface Window {
    flora: FloraApi;
  }
}

export {};
