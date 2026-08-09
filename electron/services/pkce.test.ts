import { describe, expect, it } from 'vitest';
import { challengeFor, createState, createVerifier } from './pkce';

describe('pkce', () => {
  it('derives the RFC 7636 Appendix B challenge from its verifier', () => {
    expect(challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });

  it('creates verifiers within the RFC length bounds', () => {
    const verifier = createVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
  });

  it('creates verifiers using only unreserved base64url characters', () => {
    expect(createVerifier()).toMatch(/^[A-Za-z0-9\-._~]+$/);
  });

  it('never repeats a verifier', () => {
    const seen = new Set(Array.from({ length: 100 }, () => createVerifier()));
    expect(seen.size).toBe(100);
  });

  it('never repeats a state', () => {
    const seen = new Set(Array.from({ length: 100 }, () => createState()));
    expect(seen.size).toBe(100);
  });
});
