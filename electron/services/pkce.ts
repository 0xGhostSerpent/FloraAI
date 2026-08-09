import { createHash, randomBytes } from 'node:crypto';

const base64url = (buffer: Buffer): string => buffer.toString('base64url');

/** 32 random bytes encode to 43 base64url characters — the RFC 7636 minimum. */
export const createVerifier = (): string => base64url(randomBytes(32));

/** S256 only. The `plain` method is never offered. */
export const challengeFor = (verifier: string): string =>
  base64url(createHash('sha256').update(verifier).digest());

export const createState = (): string => base64url(randomBytes(16));
