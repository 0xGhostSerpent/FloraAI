export type FloraResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

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
};

declare global {
  interface Window {
    flora: FloraApi;
  }
}

export {};
