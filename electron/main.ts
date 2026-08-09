import { app, BrowserWindow, ipcMain, session, shell } from 'electron';
import * as path from 'node:path';
import { deleteSecret, isEncryptionAvailable, readSecret, writeSecret } from './services/secrets';
import { isConfigured, signIn } from './services/oauth';
import { geocodeQuery, locateByIp } from './services/geocode';
import { findNurseries } from './services/nurseries';
import { findOccurrences, matchSpecies } from './services/gbif';
import type { Coord } from './services/geo';

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const isDev = Boolean(DEV_SERVER_URL);

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  // src/index.css imports Lora, Nunito and Fira Code from Google Fonts.
  // Without these two hosts all three themes fall back to a system serif,
  // and only in packaged builds — the CSP is not applied in development.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
  [
    "connect-src 'self'",
    'https://generativelanguage.googleapis.com',
    'https://identitytoolkit.googleapis.com',
    'https://securetoken.googleapis.com',
  ].join(' '),
].join('; ');

function applyContentSecurityPolicy(): void {
  // Skipped in dev: Vite's HMR client needs eval and a websocket connection.
  if (isDev) return;
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [CSP],
      },
    });
  });
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 900,
    minHeight: 700,
    backgroundColor: '#000000',
    title: 'Flora AI',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Anything trying to open a new window leaves for the real browser instead.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });

  // The app is a single document; block navigation away from it.
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault();
  });

  // A failed load otherwise presents as a silent blank window.
  win.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error(`[flora] failed to load ${url}: ${description} (${code})`);
  });

  if (DEV_SERVER_URL) {
    void win.loadURL(DEV_SERVER_URL);
  } else {
    void win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

function registerIpc(): void {
  ipcMain.handle('flora:openExternal', async (_event, url: unknown) => {
    if (typeof url !== 'string' || !url.startsWith('https://')) return;
    await shell.openExternal(url);
  });

  ipcMain.handle('flora:secrets:get', (_event, name: unknown) =>
    typeof name === 'string' ? readSecret(name) : null,
  );

  ipcMain.handle('flora:secrets:set', (_event, payload: unknown) => {
    const { name, value } = (payload ?? {}) as { name?: string; value?: string };
    if (typeof name !== 'string' || typeof value !== 'string') return false;
    if (!isEncryptionAvailable()) return false;
    writeSecret(name, value);
    return true;
  });

  ipcMain.handle('flora:secrets:clear', (_event, name: unknown) => {
    if (typeof name === 'string') deleteSecret(name);
  });

  ipcMain.handle('flora:auth:signIn', () => signIn());
  ipcMain.handle('flora:auth:isConfigured', () => isConfigured());

  ipcMain.handle('flora:geocode', (_event, query: unknown) =>
    typeof query === 'string' && query.trim()
      ? geocodeQuery(query.trim())
      : { ok: false, error: { code: 'GEOCODE_NONE', message: 'Enter a city or postcode.' } },
  );

  ipcMain.handle('flora:locateByIp', () => locateByIp());

  ipcMain.handle('flora:findNurseries', (_event, opts: unknown) => {
    const { lat, lon, radiusKm } = (opts ?? {}) as Partial<{
      lat: number;
      lon: number;
      radiusKm: number;
    }>;
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return { ok: false, error: { code: 'GEOCODE_NONE', message: 'No location set.' } };
    }
    return findNurseries({ lat, lon, radiusKm: radiusKm ?? 15 });
  });

  ipcMain.handle('flora:gbifMatch', (_event, name: unknown) =>
    typeof name === 'string' && name.trim()
      ? matchSpecies(name.trim())
      : { ok: false, error: { code: 'SPECIES_NO_MATCH', message: 'No species name available.' } },
  );

  ipcMain.handle('flora:gbifOccurrences', (_event, payload: unknown) => {
    const { taxonKey, origin } = (payload ?? {}) as { taxonKey?: number; origin?: Coord };
    if (typeof taxonKey !== 'number') {
      return { ok: false, error: { code: 'SPECIES_NO_MATCH', message: 'No species key.' } };
    }
    return findOccurrences(taxonKey, origin);
  });
}

void app.whenReady().then(() => {
  applyContentSecurityPolicy();
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
