import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { shell } from 'electron';
import { err, ok, Result } from './result';
import { postForm } from './http';
import { challengeFor, createState, createVerifier } from './pkce';
import { deleteSecret, readSecret, writeSecret } from './secrets';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.file',
];
const CONSENT_TIMEOUT_MS = 5 * 60 * 1000;

export type GoogleTokens = { idToken: string; accessToken: string };

type ConsentOpts = {
  clientId: string;
  redirectUri: string;
  challenge: string;
  state: string;
};

export function buildConsentUrl(opts: ConsentOpts): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    code_challenge: opts.challenge,
    code_challenge_method: 'S256',
    state: opts.state,
    access_type: 'offline',
    prompt: 'consent',
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export function parseCallback(rawUrl: string, expectedState: string): Result<{ code: string }> {
  const url = new URL(rawUrl, 'http://127.0.0.1');
  const error = url.searchParams.get('error');

  if (error === 'access_denied') return err('OAUTH_CANCELLED', 'Sign-in cancelled.');
  if (error) return err('OAUTH_EXCHANGE_FAILED', `Google returned: ${error}`);

  // State is compared before the code is used, so a mismatch never reaches
  // the token endpoint.
  const state = url.searchParams.get('state');
  if (!state || state !== expectedState) {
    return err('OAUTH_STATE_MISMATCH', 'Sign-in could not be verified. Try again.');
  }

  const code = url.searchParams.get('code');
  if (!code) return err('OAUTH_EXCHANGE_FAILED', 'No authorization code was returned.');

  return ok({ code });
}

type OAuthConfig = { clientId: string; clientSecret: string };

function loadConfig(): OAuthConfig | null {
  // First check secrets store (saved via Settings UI)
  try {
    const secretId = readSecret('google_client_id');
    const secretSecret = readSecret('google_client_secret');
    if (secretId && !secretId.startsWith('REPLACE_ME') && secretId.includes('.apps.googleusercontent.com')) {
      return { clientId: secretId.trim(), clientSecret: (secretSecret || '').trim() };
    }
  } catch {
    // Continue to file checks
  }

  // Packaged builds ship the file via electron-builder extraResources;
  // development reads it straight from the source tree.
  const candidates = [
    process.resourcesPath ? path.join(process.resourcesPath, 'oauth-config.json') : '',
    path.join(__dirname, '../../electron/oauth-config.json'),
    path.join(__dirname, '../oauth-config.json'),
    path.join(process.cwd(), 'electron/oauth-config.json'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    try {
      const parsed = JSON.parse(readFileSync(candidate, 'utf8')) as Partial<OAuthConfig>;
      if (
        parsed.clientId &&
        !parsed.clientId.startsWith('REPLACE_ME') &&
        parsed.clientId.includes('.apps.googleusercontent.com') &&
        !parsed.clientId.includes('8q6m2f3sk9kcmv5r1i3u4om9d51o4gcv')
      ) {
        return { clientId: parsed.clientId.trim(), clientSecret: (parsed.clientSecret || '').trim() };
      }
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

export const isConfigured = (): boolean => loadConfig() !== null;

const DONE_PAGE = `<!doctype html><meta charset="utf-8">
<title>Flora AI</title>
<body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0">
<p>Signed in. You can close this window and return to Flora AI.</p>`;

type Listener = {
  redirectUri: string;
  wait: Promise<Result<{ code: string }>>;
};

function awaitCallback(state: string): Promise<Listener> {
  return new Promise((resolveListener) => {
    let settle!: (value: Result<{ code: string }>) => void;
    const wait = new Promise<Result<{ code: string }>>((r) => {
      settle = r;
    });

    let done = false;
    const finish = (value: Result<{ code: string }>) => {
      if (done) return; // The listener accepts exactly one callback.
      done = true;
      settle(value);
      server.close();
    };

    const server = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(DONE_PAGE);
      finish(parseCallback(req.url ?? '/', state));
    });

    const timer = setTimeout(
      () => finish(err('OAUTH_TIMEOUT', 'Sign-in timed out. Try again.')),
      CONSENT_TIMEOUT_MS,
    );
    // Do not hold the app open waiting for a callback nobody is going to send.
    timer.unref?.();
    server.on('close', () => clearTimeout(timer));

    // Port 0 lets the OS pick a free port. Google wildcards the port for
    // Desktop-type clients, so nothing needs registering in advance.
    // Bound to 127.0.0.1 only — never 0.0.0.0.
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      resolveListener({ redirectUri: `http://127.0.0.1:${port}`, wait });
    });
  });
}

type TokenResponse = {
  id_token?: string;
  access_token?: string;
  refresh_token?: string;
};

export async function signIn(): Promise<Result<GoogleTokens>> {
  const config = loadConfig();
  if (!config) {
    return err('OAUTH_NOT_CONFIGURED', 'Google sign-in is not configured.');
  }

  const verifier = createVerifier();
  const state = createState();
  const listener = await awaitCallback(state);

  const consentUrl = buildConsentUrl({
    clientId: config.clientId,
    redirectUri: listener.redirectUri,
    challenge: challengeFor(verifier),
    state,
  });

  // Open the user's default browser for Google sign-in
  await shell.openExternal(consentUrl);

  const callback = await listener.wait;
  if (!callback.ok) return callback;

  const formBody: Record<string, string> = {
    code: callback.data.code,
    client_id: config.clientId,
    code_verifier: verifier,
    grant_type: 'authorization_code',
    redirect_uri: listener.redirectUri,
  };
  if (config.clientSecret) {
    formBody.client_secret = config.clientSecret;
  }

  const tokens = await postForm<TokenResponse>(TOKEN_ENDPOINT, formBody);

  if (!tokens.ok) {
    return err('OAUTH_EXCHANGE_FAILED', "Couldn't complete sign-in. Try again.");
  }

  const { id_token: idToken, access_token: accessToken, refresh_token: refreshToken } = tokens.data;
  if (!idToken || !accessToken) {
    return err('OAUTH_EXCHANGE_FAILED', "Couldn't complete sign-in. Try again.");
  }

  try {
    writeSecret('google_access_token', accessToken);
    if (refreshToken) {
      writeSecret('google_refresh_token', refreshToken);
    }
  } catch {
    // No keychain: the user signs in again next time. Not fatal.
  }

  return ok({ idToken, accessToken });
}

export async function refreshAccessToken(): Promise<Result<string>> {
  const config = loadConfig();
  const refreshToken = readSecret('google_refresh_token');
  if (!config || !refreshToken) {
    return err('OAUTH_NOT_SIGNED_IN', 'Please sign in with Google to sync data.');
  }

  const refreshBody: Record<string, string> = {
    client_id: config.clientId,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  };
  if (config.clientSecret) {
    refreshBody.client_secret = config.clientSecret;
  }

  const tokens = await postForm<TokenResponse>(TOKEN_ENDPOINT, refreshBody);

  if (!tokens.ok || !tokens.data.access_token) {
    return err('OAUTH_REFRESH_FAILED', 'Could not refresh Google session. Please sign in again.');
  }

  try {
    writeSecret('google_access_token', tokens.data.access_token);
    if (tokens.data.refresh_token) {
      writeSecret('google_refresh_token', tokens.data.refresh_token);
    }
  } catch {
    // Ignore secret writing issues
  }

  return ok(tokens.data.access_token);
}

export async function getAccessToken(): Promise<Result<string>> {
  const token = readSecret('google_access_token');
  if (token) {
    return ok(token);
  }
  return refreshAccessToken();
}

export function clearAuthTokens(): void {
  deleteSecret('google_access_token');
  deleteSecret('google_refresh_token');
}

