import { app, safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

/** name -> base64 of the OS-encrypted buffer. */
type Vault = Record<string, string>;

/**
 * 'os'    - encrypted by the OS keychain (macOS Keychain, DPAPI, libsecret).
 * 'basic' - Chromium's fallback: obfuscated with a well-known key, not secret
 *           from anyone with read access to the file. Honest about it in the UI.
 */
export type StorageBackend = 'os' | 'basic';

const vaultPath = (): string => path.join(app.getPath('userData'), 'secrets.json');

/**
 * Presence of this file means a previous launch found no OS keyring, so the
 * next launch must ask Chromium for its basic backend instead.
 */
const fallbackMarkerPath = (): string =>
  path.join(app.getPath('userData'), '.password-store-basic');

/**
 * Must run before app.whenReady(): the password-store switch is read during
 * Chromium startup, but safeStorage.isEncryptionAvailable() only answers after
 * ready. The marker written by ensureStorageBackend() bridges the two.
 */
export function applyKeyringFallback(): void {
  // Windows (DPAPI) and macOS (Keychain) always have a backend available.
  if (process.platform !== 'linux') return;
  if (existsSync(fallbackMarkerPath())) {
    app.commandLine.appendSwitch('password-store', 'basic');
  }
}

/**
 * Resolves which backend is in force, relaunching once if a Linux box turns
 * out to have no keyring (no gnome-keyring/kwallet/libsecret). Without this the
 * key silently never persists, which is exactly how the packaged .deb failed.
 *
 * Returns null when the app is relaunching and the caller should stop work.
 */
export function ensureStorageBackend(): StorageBackend | null {
  const usingFallback = existsSync(fallbackMarkerPath());

  if (safeStorage.isEncryptionAvailable()) return usingFallback ? 'basic' : 'os';

  // The marker is written *before* relaunching, so the restarted process takes
  // the branch above (or the one below) and never loops.
  if (process.platform === 'linux' && !usingFallback) {
    mkdirSync(path.dirname(fallbackMarkerPath()), { recursive: true });
    writeFileSync(fallbackMarkerPath(), '');
    app.relaunch();
    app.exit(0);
    return null;
  }

  return 'basic';
}

export const storageBackend = (): StorageBackend =>
  existsSync(fallbackMarkerPath()) || !safeStorage.isEncryptionAvailable() ? 'basic' : 'os';

function readVault(): Vault {
  const file = vaultPath();
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Vault;
  } catch {
    // A corrupt vault is recoverable: the user re-enters the key.
    return {};
  }
}

function writeVault(vault: Vault): void {
  const file = vaultPath();
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(vault), { mode: 0o600 });
}

export function readSecret(name: string): string | null {
  const stored = readVault()[name];
  if (!stored || !safeStorage.isEncryptionAvailable()) return null;
  try {
    return safeStorage.decryptString(Buffer.from(stored, 'base64'));
  } catch {
    return null;
  }
}

/** Returns false when no backend is available at all, rather than throwing. */
export function writeSecret(name: string, value: string): boolean {
  if (!safeStorage.isEncryptionAvailable()) return false;
  const vault = readVault();
  vault[name] = safeStorage.encryptString(value).toString('base64');
  writeVault(vault);
  return true;
}

export function deleteSecret(name: string): void {
  const vault = readVault();
  delete vault[name];
  writeVault(vault);
}

export const isEncryptionAvailable = (): boolean => safeStorage.isEncryptionAvailable();
