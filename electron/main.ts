import { app, BrowserWindow, ipcMain, session, shell } from 'electron';
import * as path from 'node:path';
import {
  applyKeyringFallback,
  deleteSecret,
  ensureStorageBackend,
  readSecret,
  storageBackend,
  writeSecret,
} from './services/secrets';
import { clearAuthTokens, isConfigured, signIn } from './services/oauth';
import { getLastDriveSync, syncToGoogleDrive } from './services/drive';
import { geocodeQuery, locateByIp } from './services/geocode';
import { findNurseries } from './services/nurseries';
import { findOccurrences, matchSpecies } from './services/gbif';
import { refreshOnlineStatus, startNetworkWatch, stopNetworkWatch } from './services/net';
import { complete, listModels, type CompleteRequest, type AiTarget } from './services/ai';
import type { Coord } from './services/geo';

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const isDev = Boolean(DEV_SERVER_URL);

const CHROME_USER_AGENT =
  process.platform === 'win32'
    ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://apis.google.com https://*.firebaseio.com https://*.googleapis.com https://*.firebaseapp.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.googleusercontent.com https://*.tile.openstreetmap.org https://*.gstatic.com",
  "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://accounts.google.com https://*.firebaseio.com https://*.firebaseapp.com",
  "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://*.google.com",
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

  // Handle Firebase OAuth popup windows cleanly inside the app with standard Chrome UA
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (
      url.includes('firebaseapp.com') ||
      url.includes('accounts.google.com') ||
      url.includes('google.com/o/oauth2')
    ) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 680,
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
          },
        },
      };
    }
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
  ipcMain.handle('flora:ai:complete', (_event, payload: unknown) =>
    complete((payload ?? {}) as CompleteRequest),
  );

  ipcMain.handle('flora:ai:listModels', (_event, payload: unknown) =>
    listModels((payload ?? {}) as AiTarget),
  );

  ipcMain.handle('flora:net:status', () => refreshOnlineStatus());

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
    return writeSecret(name, value);
  });

  ipcMain.handle('flora:secrets:backend', () => storageBackend());

  ipcMain.handle('flora:secrets:clear', (_event, name: unknown) => {
    if (typeof name === 'string') deleteSecret(name);
  });

  ipcMain.handle('flora:auth:signIn', () => signIn());
  ipcMain.handle('flora:auth:isConfigured', () => isConfigured());
  ipcMain.handle('flora:auth:clearTokens', () => clearAuthTokens());

  ipcMain.handle('flora:drive:syncBackup', (_event, payload: unknown) =>
    syncToGoogleDrive(payload),
  );
  ipcMain.handle('flora:drive:getLastSync', () => getLastDriveSync());

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

// Must precede whenReady: Chromium reads the password-store switch at startup.
applyKeyringFallback();

void app.whenReady().then(() => {
  // Null means this process is relaunching to pick up the storage fallback;
  // opening a window now would flash an instance that is about to exit.
  if (ensureStorageBackend() === null) return;

  app.userAgentFallback = CHROME_USER_AGENT;
  session.defaultSession.setUserAgent(CHROME_USER_AGENT);

  applyContentSecurityPolicy();
  registerIpc();
  startNetworkWatch();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', stopNetworkWatch);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
