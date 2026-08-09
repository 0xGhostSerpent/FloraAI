export type FloraResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

import type { Nursery, OccurrenceSet, SpeciesMatch, UserLocation } from '../store';

export type GoogleTokens = { idToken: string; accessToken: string };

export type FloraApi = {
  openExternal(url: string): Promise<void>;
  secrets: {
    get(name: string): Promise<string | null>;
    /** Resolves false when the OS keychain is unavailable. */
    set(name: string, value: string): Promise<boolean>;
    clear(name: string): Promise<void>;
  };
  auth: {
    /** Runs the PKCE loopback: consent happens in the system browser. */
    signIn(): Promise<FloraResult<GoogleTokens>>;
    /** False when electron/oauth-config.json is absent or unfilled. */
    isConfigured(): Promise<boolean>;
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
