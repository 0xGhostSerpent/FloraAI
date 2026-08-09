import { app, safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

/** name -> base64 of the OS-encrypted buffer. */
type Vault = Record<string, string>;

const vaultPath = (): string => path.join(app.getPath('userData'), 'secrets.json');

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

export function writeSecret(name: string, value: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS encryption is unavailable on this system');
  }
  const vault = readVault();
  vault[name] = safeStorage.encryptString(value).toString('base64');
  writeVault(vault);
}

export function deleteSecret(name: string): void {
  const vault = readVault();
  delete vault[name];
  writeVault(vault);
}

export const isEncryptionAvailable = (): boolean => safeStorage.isEncryptionAvailable();
