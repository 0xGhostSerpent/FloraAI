import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';

let userData: string;

vi.mock('electron', () => ({
  app: {
    getPath: () => userData,
  },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(`enc:${value}`),
    decryptString: (buffer: Buffer) => buffer.toString().replace(/^enc:/, ''),
  },
  shell: {
    openExternal: vi.fn(),
  },
}));

beforeEach(() => {
  userData = mkdtempSync(path.join(tmpdir(), 'flora-drive-test-'));
});

afterEach(() => {
  rmSync(userData, { recursive: true, force: true });
});

describe('drive backup service', () => {
  it('reports null when no sync has occurred yet', async () => {
    const { getLastDriveSync } = await import('./drive');
    const result = getLastDriveSync();
    expect(result).toEqual({ syncedAt: null });
  });

  it('fails gracefully when not signed in', async () => {
    const { syncToGoogleDrive } = await import('./drive');
    const result = await syncToGoogleDrive({ test: true });
    expect(result.ok).toBe(false);
  });
});
