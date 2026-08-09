import { describe, expect, it } from 'vitest';
import { buildConsentUrl, parseCallback } from './oauth';

const opts = {
  clientId: 'client-123.apps.googleusercontent.com',
  redirectUri: 'http://127.0.0.1:51234',
  challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  state: 'state-abc',
};

describe('buildConsentUrl', () => {
  it('targets Google and carries every required parameter', () => {
    const url = new URL(buildConsentUrl(opts));

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe(opts.clientId);
    expect(url.searchParams.get('redirect_uri')).toBe(opts.redirectUri);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge')).toBe(opts.challenge);
    expect(url.searchParams.get('state')).toBe(opts.state);
    expect(url.searchParams.get('scope')).toBe('openid email profile');
  });

  it('always requests S256 and never plain', () => {
    expect(new URL(buildConsentUrl(opts)).searchParams.get('code_challenge_method')).toBe('S256');
  });
});

describe('parseCallback', () => {
  it('extracts the code when the state matches', () => {
    expect(parseCallback('/?code=auth-code-1&state=state-abc', 'state-abc')).toEqual({
      ok: true,
      data: { code: 'auth-code-1' },
    });
  });

  it('rejects a mismatched state without returning a code', () => {
    expect(parseCallback('/?code=auth-code-1&state=wrong', 'state-abc')).toMatchObject({
      ok: false,
      error: { code: 'OAUTH_STATE_MISMATCH' },
    });
  });

  it('rejects a callback with no state at all', () => {
    expect(parseCallback('/?code=auth-code-1', 'state-abc')).toMatchObject({
      ok: false,
      error: { code: 'OAUTH_STATE_MISMATCH' },
    });
  });

  it('reports a denied consent as a cancellation, not a failure', () => {
    expect(parseCallback('/?error=access_denied&state=state-abc', 'state-abc')).toMatchObject({
      ok: false,
      error: { code: 'OAUTH_CANCELLED' },
    });
  });

  it('reports any other Google error as an exchange failure', () => {
    expect(parseCallback('/?error=invalid_scope&state=state-abc', 'state-abc')).toMatchObject({
      ok: false,
      error: { code: 'OAUTH_EXCHANGE_FAILED' },
    });
  });

  it('rejects a callback with a matching state but no code', () => {
    expect(parseCallback('/?state=state-abc', 'state-abc')).toMatchObject({
      ok: false,
      error: { code: 'OAUTH_EXCHANGE_FAILED' },
    });
  });
});
