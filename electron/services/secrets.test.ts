import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';

/**
 * The keyring fallback is the fix for the packaged .deb never persisting a key:
 * safeStorage is unavailable on a Linux box without gnome-keyring/libsecret, and
 * the switch that enables Chromium's basic backend can only be set before ready.
 * These tests pin the marker-and-relaunch handshake that bridges that gap.
 */
let userData: string;
let encryptionAvailable = true;
const appliedSwitches: Array<[string, string]> = [];
const lifecycle: string[] = [];

vi.mock('electron', () => ({
  app: {
    getPath: () => userData,
    commandLine: {
      appendSwitch: (name: string, value: string) => appliedSwitches.push([name, value]),
    },
    relaunch: () => lifecycle.push('relaunch'),
    exit: (code: number) => lifecycle.push(`exit:${code}`),
  },
  safeStorage: {
    isEncryptionAvailable: () => encryptionAvailable,
    encryptString: (value: string) => Buffer.from(`enc:${value}`),
    decryptString: (buffer: Buffer) => buffer.toString().replace(/^enc:/, ''),
  },
}));

const markerPath = () => path.join(userData, '.password-store-basic');

// Imported dynamically so each test sees the mock above with fresh module state.
const load = () => import('./secrets');

beforeEach(() => {
  userData = mkdtempSync(path.join(tmpdir(), 'flora-secrets-'));
  encryptionAvailable = true;
  appliedSwitches.length = 0;
  lifecycle.length = 0;
  vi.resetModules();
});

afterEach(() => rmSync(userData, { recursive: true, force: true }));

describe('applyKeyringFallback', () => {
  it('does nothing when no previous run reported a missing keyring', async () => {
    const { applyKeyringFallback } = await load();
    applyKeyringFallback();
    expect(appliedSwitches).toEqual([]);
  });

  it('asks Chromium for the basic store once the marker exists', async () => {
    const { ensureStorageBackend, applyKeyringFallback } = await load();
    encryptionAvailable = false;
    ensureStorageBackend(); // writes the marker

    applyKeyringFallback();

    expect(appliedSwitches).toEqual([['password-store', 'basic']]);
  });

  it('leaves Windows and macOS alone, where a backend always exists', async () => {
    const platform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    try {
      const { ensureStorageBackend, applyKeyringFallback } = await load();
      encryptionAvailable = false;
      ensureStorageBackend();
      applyKeyringFallback();
      expect(appliedSwitches).toEqual([]);
    } finally {
      Object.defineProperty(process, 'platform', { value: platform, configurable: true });
    }
  });
});

describe('ensureStorageBackend', () => {
  it('reports the OS keychain when encryption is available', async () => {
    const { ensureStorageBackend } = await load();
    expect(ensureStorageBackend()).toBe('os');
    expect(lifecycle).toEqual([]);
    expect(existsSync(markerPath())).toBe(false);
  });

  it('writes the marker and relaunches when no keyring is present', async () => {
    const { ensureStorageBackend } = await load();
    encryptionAvailable = false;

    // Null tells main.ts to stop, rather than flash a window that is exiting.
    expect(ensureStorageBackend()).toBeNull();
    expect(existsSync(markerPath())).toBe(true);
    expect(lifecycle).toEqual(['relaunch', 'exit:0']);
  });

  it('does not relaunch a second time if the fallback still reports nothing', async () => {
    const { ensureStorageBackend } = await load();
    encryptionAvailable = false;
    ensureStorageBackend(); // first run: marker + relaunch
    lifecycle.length = 0;

    // The marker written before relaunching is what breaks the loop.
    expect(ensureStorageBackend()).toBe('basic');
    expect(lifecycle).toEqual([]);
  });

  it('reports basic once the fallback is in force and working', async () => {
    const { ensureStorageBackend } = await load();
    encryptionAvailable = false;
    ensureStorageBackend();

    // What the relaunched process sees: the switch made safeStorage usable.
    encryptionAvailable = true;
    expect(ensureStorageBackend()).toBe('basic');
  });
});

describe('secret round-trip', () => {
  it('stores and reads a value per name', async () => {
    const { writeSecret, readSecret } = await load();

    expect(writeSecret('ai_api_key_openai', 'sk-abc')).toBe(true);
    expect(writeSecret('ai_api_key_groq', 'gsk_xyz')).toBe(true);

    // Per-provider slots must not overwrite one another.
    expect(readSecret('ai_api_key_openai')).toBe('sk-abc');
    expect(readSecret('ai_api_key_groq')).toBe('gsk_xyz');
  });

  it('returns false instead of throwing when no backend exists', async () => {
    const { writeSecret } = await load();
    encryptionAvailable = false;
    // The old version threw here, which surfaced as a silent failure to save.
    expect(writeSecret('ai_api_key_gemini', 'AIza')).toBe(false);
  });

  it('deletes a single slot without disturbing the others', async () => {
    const { writeSecret, deleteSecret, readSecret } = await load();
    writeSecret('ai_api_key_openai', 'sk-abc');
    writeSecret('ai_api_key_groq', 'gsk_xyz');

    deleteSecret('ai_api_key_openai');

    expect(readSecret('ai_api_key_openai')).toBeNull();
    expect(readSecret('ai_api_key_groq')).toBe('gsk_xyz');
  });

  it('reports an absent secret as null', async () => {
    const { readSecret } = await load();
    expect(readSecret('nothing_here')).toBeNull();
  });
});

describe('storageBackend', () => {
  it('says basic whenever the marker is set or encryption is unavailable', async () => {
    const { storageBackend, ensureStorageBackend } = await load();
    expect(storageBackend()).toBe('os');

    encryptionAvailable = false;
    expect(storageBackend()).toBe('basic');

    ensureStorageBackend();
    encryptionAvailable = true;
    expect(storageBackend()).toBe('basic');
  });
});
