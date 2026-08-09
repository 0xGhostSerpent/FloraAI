# Flora AI Desktop Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing Flora AI web app into an installable Linux and Windows desktop application with no paywall and working Google sign-in.

**Architecture:** Electron wraps the existing React renderer unchanged. A new `electron/` main process holds all Node-side logic behind a `contextBridge` API (`window.flora`), because the external services this app needs reject browser-origin requests. Google sign-in is a PKCE loopback through the system browser, since Electron windows are blocked from Google's OAuth pages.

**Tech Stack:** Electron 33, electron-builder, TypeScript 5.8, React 19, Vite 6, Vitest 3, Firebase JS SDK 12.

This is **plan 1 of 2**. It ends with a packaged desktop app that runs every existing feature. Plan 2 (`2026-08-09-flora-plant-features.md`) adds webcam capture, the four post-capture actions, the nursery finder, and the wild-occurrence screen.

**Spec:** `docs/superpowers/specs/2026-08-09-flora-ai-desktop-design.md`

## Global Constraints

- **Every renderer→Node call goes through `contextBridge`.** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Never relax these to make something work.
- **All main-process service functions return `Result<T>`** — never throw across an IPC boundary.
- **All network calls carry a 10-second timeout** via `AbortSignal.timeout(10_000)`.
- **No `alert()` anywhere.** Errors render inline. The existing `alert()` calls at `src/App.tsx:148` and `src/App.tsx:250` are removed by this plan.
- **Secrets never touch `localStorage`** and are never logged. Gemini API key and OAuth refresh token both live in `safeStorage`.
- **PKCE method is always `S256`.** Never offer `plain`.
- **The loopback server binds to `127.0.0.1` only** — never `0.0.0.0`, never a fixed port.
- Node ≥ 20. The repo uses `"type": "module"`; the Electron main process is CommonJS and is isolated via a generated `dist-electron/package.json`.
- Commit after every task. Work on `master` (repo baseline is commit `03fcd84`).

---

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `electron/main.ts` | App lifecycle, `BrowserWindow`, CSP, navigation guards, IPC registration |
| `electron/preload.ts` | `contextBridge` — the entire `window.flora` surface |
| `electron/tsconfig.json` | Compiles `electron/` to CommonJS in `dist-electron/` |
| `electron/oauth-config.example.json` | Committed template for OAuth client credentials |
| `electron/services/result.ts` | `Result<T>`, `ok()`, `err()` |
| `electron/services/http.ts` | fetch wrapper: timeout, User-Agent, JSON, `Result` |
| `electron/services/geo.ts` | `haversineKm` and coordinate helpers (pure) |
| `electron/services/secrets.ts` | `safeStorage`-encrypted key/value store on disk |
| `electron/services/pkce.ts` | Verifier, challenge, state (pure) |
| `electron/services/oauth.ts` | Consent URL, callback parsing, loopback server, token exchange |
| `scripts/write-main-package.mjs` | Emits `dist-electron/package.json` marking output CommonJS |
| `vitest.config.ts` | Test config, node environment |
| `src/types/flora.d.ts` | Ambient type for `window.flora` |
| `src/screens/*.tsx` | One file per screen, extracted from `App.tsx` |
| `src/components/ErrorCard.tsx` | Inline error + retry |

**Modified:** `package.json`, `vite.config.ts`, `src/App.tsx`, `src/firebase.ts`, `src/store.ts`, `.gitignore`, `README.md`

**Deleted:** `flutter_app/` (entire directory)

---

## Task 1: Electron shell and build pipeline

**Files:**
- Create: `electron/main.ts`, `electron/preload.ts`, `electron/tsconfig.json`, `scripts/write-main-package.mjs`, `vitest.config.ts`, `src/types/flora.d.ts`
- Modify: `package.json`, `vite.config.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `window.flora.openExternal(url: string): Promise<void>`; the `dist-electron/main.js` entry point; `npm run dev:electron`, `npm run build`, `npm test`.

- [ ] **Step 1: Install dependencies**

```bash
npm install --save-dev electron@^33.0.0 electron-builder@^25.1.8 concurrently@^9.1.0 wait-on@^8.0.1 cross-env@^7.0.3 vitest@^3.0.0
```

- [ ] **Step 2: Add the Vite base path**

Production loads the renderer over `file://`, where Vite's default absolute `/assets/...` paths resolve to filesystem root and every asset 404s. Relative paths fix it.

In `vite.config.ts`, add `base: './'` as the first key of the returned config object, immediately before `plugins`:

```ts
  return {
    base: './',
    plugins: [react(), tailwindcss()],
```

- [ ] **Step 3: Create the Electron TypeScript config**

Create `electron/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "../dist-electron",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "sourceMap": true
  },
  "include": ["**/*.ts"],
  "exclude": ["**/*.test.ts"]
}
```

- [ ] **Step 4: Create the CommonJS marker script**

The root `package.json` declares `"type": "module"`, which would make the compiled `.js` files be parsed as ESM and crash on `require`. A nested `package.json` overrides that for `dist-electron/` only.

Create `scripts/write-main-package.mjs`:

```js
import { mkdirSync, writeFileSync } from 'node:fs';

mkdirSync('dist-electron', { recursive: true });
writeFileSync('dist-electron/package.json', JSON.stringify({ type: 'commonjs' }, null, 2) + '\n');
console.log('wrote dist-electron/package.json (type: commonjs)');
```

- [ ] **Step 5: Write the main process**

Create `electron/main.ts`:

```ts
import { app, BrowserWindow, ipcMain, session, shell } from 'electron';
import * as path from 'node:path';

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const isDev = Boolean(DEV_SERVER_URL);

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
  "font-src 'self' data:",
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
```

- [ ] **Step 6: Write the preload bridge**

Create `electron/preload.ts`:

```ts
import { contextBridge, ipcRenderer } from 'electron';

const invoke = <T>(channel: string, payload?: unknown): Promise<T> =>
  ipcRenderer.invoke(channel, payload) as Promise<T>;

contextBridge.exposeInMainWorld('flora', {
  openExternal: (url: string) => invoke<void>('flora:openExternal', url),
});
```

- [ ] **Step 7: Declare the renderer-side type**

Create `src/types/flora.d.ts`:

```ts
export type FloraApi = {
  openExternal(url: string): Promise<void>;
};

declare global {
  interface Window {
    flora: FloraApi;
  }
}

export {};
```

- [ ] **Step 8: Add the Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['electron/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
```

- [ ] **Step 9: Wire up package.json**

In `package.json`, add `"main": "dist-electron/main.js"` at the top level (next to `"version"`), and replace the `scripts` block with:

```json
  "scripts": {
    "dev": "vite --port=3000 --host=0.0.0.0",
    "dev:electron": "npm run build:main && concurrently -k \"npm:dev\" \"wait-on tcp:3000 && cross-env VITE_DEV_SERVER_URL=http://localhost:3000 electron .\"",
    "build:main": "tsc -p electron/tsconfig.json && node scripts/write-main-package.mjs",
    "build": "vite build && npm run build:main",
    "preview": "vite preview",
    "clean": "rm -rf dist dist-electron server.js",
    "lint": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "dist:linux": "npm run build && electron-builder --linux AppImage deb",
    "dist:win": "npm run build && electron-builder --win nsis"
  },
```

Then add a top-level `"build"` key for electron-builder:

```json
  "build": {
    "appId": "com.ctrlcreate.floraai",
    "productName": "Flora AI",
    "directories": { "output": "release" },
    "files": ["dist/**/*", "dist-electron/**/*"],
    "linux": { "target": ["AppImage", "deb"], "category": "Education" },
    "win": { "target": ["nsis"] }
  },
```

- [ ] **Step 10: Ignore the release directory**

Add `release/` to `.gitignore` under the `dist-electron/` line.

- [ ] **Step 11: Verify the app launches in development**

Run: `npm run dev:electron`

Expected: a native window titled "Flora AI" opens showing the existing onboarding screen. No errors in the terminal. Close the window; the process exits.

- [ ] **Step 12: Verify the production build loads**

Run: `npm run build && cross-env NODE_ENV=production electron .`

Expected: the same window opens, rendering from `dist/index.html`. If the window is blank, `base: './'` from Step 2 is missing.

- [ ] **Step 13: Verify the test runner works**

Run: `npm test`

Expected: `No test files found` and exit code 0 — the runner is wired up; tests arrive in Task 4.

- [ ] **Step 14: Commit**

```bash
git add electron/ scripts/ vitest.config.ts src/types/ package.json package-lock.json vite.config.ts .gitignore
git commit -m "feat: wrap app in Electron shell with build and test pipeline"
```

---

## Task 2: Remove the paywall and the Flutter stub

**Files:**
- Modify: `src/App.tsx:29-808` (many small deletions)
- Delete: `flutter_app/` (entire directory)

**Interfaces:**
- Consumes: nothing.
- Produces: an `App.tsx` with no `isPremium`, `installDate`, `getIsTrialActive`, `canAccessApp`, `handlePaywallSuccess`, or `cardDetails`; `currentScreen` union without `'paywall'`.

Deletion-only task. No tests — the verification is the grep in Step 8 plus the manual pass in Step 9.

- [ ] **Step 1: Delete the Flutter stub**

```bash
git rm -r flutter_app/
```

- [ ] **Step 2: Remove paywall state declarations**

In `src/App.tsx`, delete these lines:

- line 36: `const [installDate, setInstallDate] = useState<number | null>(null);`
- line 37: `const [isPremium, setIsPremium] = useState(false);`
- line 140: `const [cardDetails, setCardDetails] = useState({ number: '', exp: '', cvc: '' });`

In the `currentScreen` declaration at line 47, remove `'paywall' | ` from the union.

- [ ] **Step 3: Remove paywall logic from initialization**

In the `initApp` effect, delete the `premium` const (line 71), the whole `iDate` block (lines 73-77), `setIsPremium(premium);` (line 81), and `setInstallDate(...)` (line 82).

In `completeOnboarding` (lines 132-138), delete the three lines dealing with `now` and `flora_install_date`, leaving only `setHasOnboarded(true)` and the `flora_onboarded` write.

- [ ] **Step 4: Delete the trial and paywall functions**

Delete `handlePaywallSuccess` (lines 141-150), `getIsTrialActive` (lines 153-157), and `const canAccessApp = ...` (line 159).

- [ ] **Step 5: Remove the capture gate**

In `handleCameraCapture`, delete lines 164-167:

```ts
      if (!canAccessApp) {
        setCurrentScreen('paywall');
        return;
      }
```

- [ ] **Step 6: Remove the forced redirect and the paywall screen**

Delete lines 383-386 entirely (the `// Enforce Paywall` comment and its `if` block) — this is a `setState` call during render, which React 19 warns about regardless.

Delete the whole `{currentScreen === 'paywall' && ( ... )}` block (lines 693-717).

- [ ] **Step 7: Remove the paywall entry points**

In Settings, delete the `{!getIsTrialActive() && !isPremium && (...)}` block containing the "Upgrade to Premium" button (lines 763-767).

In the bottom nav, replace the "Pro" button (lines 797-800) with a Nurseries button. `Store` must be added to the `lucide-react` import on line 2; `CreditCard` must be removed from it.

```tsx
                    <button onClick={() => setCurrentScreen('nurseries')} className={`flex flex-col items-center gap-1.5 w-16 transition-colors ${currentScreen === 'nurseries' ? 'text-[var(--color-accent)]' : 'text-text-muted hover:text-text-main'}`}>
                        <Store size={24} strokeWidth={2.5} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Nurseries</span>
                    </button>
```

Add `'nurseries'` to the `currentScreen` union from Step 2. The screen itself arrives in plan 2; for now clicking it renders nothing, which is expected.

Also remove `'paywall'` from the nav's visibility condition on line 785 and from the app-bar title expression on line 457.

- [ ] **Step 8: Verify no paywall references remain**

Run: `grep -rin "premium\|paywall\|trial\|subscri\|cardDetails" src/ electron/`

Expected: no output.

- [ ] **Step 9: Verify the app still runs**

Run: `npm run dev:electron`

Expected: onboarding → Accept & Continue → home screen. No Pro button in the nav. Clicking Scan opens a file picker and never a paywall. `npm run lint` passes.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: remove paywall and delete non-functional Flutter stub"
```

---

## Task 3: Split App.tsx into screen components

**Files:**
- Modify: `src/App.tsx` (reduce to routing and shared state)
- Create: `src/screens/OnboardingScreen.tsx`, `src/screens/HomeScreen.tsx`, `src/screens/ScannerScreen.tsx`, `src/screens/ChatScreen.tsx`, `src/screens/HistoryScreen.tsx`, `src/screens/SettingsScreen.tsx`, `src/components/ErrorCard.tsx`

**Interfaces:**
- Consumes: Task 2's `App.tsx`.
- Produces: each screen as a default-exported component taking an explicit props object. `App.tsx` owns all state and passes values plus callbacks down. No screen imports another screen.

This is a **behaviour-preserving refactor**. Nothing about the UI changes. Move JSX and its handlers into components, replacing closure variables with props.

- [ ] **Step 1: Create the shared error component**

Create `src/components/ErrorCard.tsx`:

```tsx
import { AlertTriangle, RotateCw } from 'lucide-react';

type Props = {
  message: string;
  onRetry?: () => void;
};

export default function ErrorCard({ message, onRetry }: Props) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-[var(--radius-dynamic)] p-5 flex gap-4 items-start">
      <AlertTriangle size={22} className="text-red-500 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm text-text-main leading-relaxed font-medium">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-red-500 hover:brightness-125"
          >
            <RotateCw size={14} /> Try again
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Extract OnboardingScreen**

Create `src/screens/OnboardingScreen.tsx` holding the JSX currently at `App.tsx:407-435`. Props: `{ onAccept: () => void }`. The sign-in button is removed here — the `!currentUser` branch and its `signInWithGoogle` call go away entirely, leaving only the disclaimer and one "Accept & Continue" button wired to `onAccept`. Sign-in returns in Task 8, in Settings.

- [ ] **Step 3: Extract HomeScreen**

Create `src/screens/HomeScreen.tsx` from `App.tsx:466-537`, including `renderStreakIcon` (lines 388-401), which is only used here.

Props:

```ts
type Props = {
  plants: PlantData[];
  streak: number;
  appTheme: string;
  lastCheckInDate: string | null;
  hasApiKey: boolean;
  onOpenSettings: () => void;
  onOpenPlant: (plant: PlantData) => void;
};
```

- [ ] **Step 4: Extract the remaining screens**

Same pattern, one file each:

- `ScannerScreen.tsx` from lines 539-605. Props: `{ selectedImage, isScanning, scanResult, scanMode, showToxicAlert, hasApiKey, onAnalyze, onSave, onDismissToxicAlert, onBack }`.
- `HistoryScreen.tsx` from lines 607-620. Props: `{ plant: PlantData }`.
- `ChatScreen.tsx` from lines 622-691. Props: `{ plant, messages, chatMessage, isChatLoading, hasApiKey, onChangeMessage, onSend, onOpenHistory, onCheckInPhoto }`.
- `SettingsScreen.tsx` from lines 719-779, minus the Upgrade button deleted in Task 2. Props: `{ apiKey, appTheme, onChangeApiKey, onChangeTheme, onSignOut }`.

The chat scroll ref stays inside `ChatScreen` along with its `useEffect` (lines 372-376) — it is local to that screen.

- [ ] **Step 5: Reduce App.tsx to a shell**

`App.tsx` keeps: all `useState` declarations, the init effect, `saveConfig`, `updateTheme`, `completeOnboarding`, `handleCameraCapture`, `goBack`, `processImage`, `savePlantData`, `loadChatHistory`, `sendMessage`, and the render tree — now a sequence of screen components inside the existing `AnimatePresence`, wrapped by the same theme div, app bar, and nav.

Delete `triggerDriveSync` (lines 123-130), `syncStatus` state (line 63), and the sync toast JSX (lines 439-448). The spec (§9) removes the simulated sync; real sync was never implemented.

- [ ] **Step 6: Verify the refactor changed nothing**

Run: `npm run lint`

Expected: no errors.

Run: `npm run dev:electron` and walk the full app — onboarding, home, settings (enter an API key, switch all three themes), scan an image file, save to garden, open the plant, check in, chat, view history, back navigation from every screen.

Expected: identical behaviour to before the refactor. `App.tsx` is now roughly 250 lines.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: split App.tsx into per-screen components"
```

---

## Task 4: Result, HTTP, and geo primitives

**Files:**
- Create: `electron/services/result.ts`, `electron/services/http.ts`, `electron/services/geo.ts`, `electron/services/geo.test.ts`, `electron/services/http.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Result<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } }`
  - `ok<T>(data: T): Result<T>`, `err(code: string, message: string): Result<never>`
  - `getJson<T>(url: string, opts?: { headers?: Record<string,string> }): Promise<Result<T>>`
  - `postForm<T>(url: string, body: Record<string,string>): Promise<Result<T>>`
  - `haversineKm(a: Coord, b: Coord): number` where `type Coord = { lat: number; lon: number }`

- [ ] **Step 1: Create the Result type**

Create `electron/services/result.ts`:

```ts
export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export const ok = <T>(data: T): Result<T> => ({ ok: true, data });

export const err = (code: string, message: string): Result<never> => ({
  ok: false,
  error: { code, message },
});
```

- [ ] **Step 2: Write the failing geo test**

Create `electron/services/geo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { haversineKm } from './geo';

describe('haversineKm', () => {
  it('returns 0 for identical points', () => {
    expect(haversineKm({ lat: 23.8103, lon: 90.4125 }, { lat: 23.8103, lon: 90.4125 })).toBe(0);
  });

  it('measures Dhaka to Chattogram at roughly 214 km', () => {
    const d = haversineKm({ lat: 23.8103, lon: 90.4125 }, { lat: 22.3569, lon: 91.7832 });
    expect(d).toBeGreaterThan(205);
    expect(d).toBeLessThan(225);
  });

  it('measures antipodal points as half the circumference', () => {
    const d = haversineKm({ lat: 0, lon: 0 }, { lat: 0, lon: 180 });
    expect(d).toBeCloseTo(Math.PI * 6371, 0);
  });

  it('is symmetric', () => {
    const a = { lat: 51.5074, lon: -0.1278 };
    const b = { lat: 48.8566, lon: 2.3522 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 9);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run electron/services/geo.test.ts`
Expected: FAIL — cannot resolve `./geo`.

- [ ] **Step 4: Implement geo.ts**

Create `electron/services/geo.ts`:

```ts
export type Coord = { lat: number; lon: number };

const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export function haversineKm(a: Coord, b: Coord): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run electron/services/geo.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Write the failing HTTP test**

Create `electron/services/http.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getJson } from './http';

afterEach(() => vi.unstubAllGlobals());

describe('getJson', () => {
  it('returns ok with the parsed body on 200', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"hello":"world"}', { status: 200 })));

    const result = await getJson<{ hello: string }>('https://example.test/x');

    expect(result).toEqual({ ok: true, data: { hello: 'world' } });
  });

  it('returns an error result on a non-200 rather than throwing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 429 })));

    const result = await getJson('https://example.test/x');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('HTTP_429');
  });

  it('returns an error result when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));

    const result = await getJson('https://example.test/x');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NETWORK');
  });

  it('sends the Flora AI User-Agent, which Nominatim requires', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await getJson('https://example.test/x');

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['User-Agent']).toContain('FloraAI');
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `npx vitest run electron/services/http.test.ts`
Expected: FAIL — cannot resolve `./http`.

- [ ] **Step 8: Implement http.ts**

Create `electron/services/http.ts`:

```ts
import { err, ok, Result } from './result';

const TIMEOUT_MS = 10_000;

// Nominatim's usage policy rejects requests without a descriptive User-Agent.
const USER_AGENT = 'FloraAI/1.0 (university project; plant identifier)';

function baseHeaders(extra?: Record<string, string>): Record<string, string> {
  return { 'User-Agent': USER_AGENT, Accept: 'application/json', ...extra };
}

async function run<T>(url: string, init: RequestInit): Promise<Result<T>> {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });

    if (!response.ok) {
      return err(`HTTP_${response.status}`, `Request failed with status ${response.status}.`);
    }

    return ok((await response.json()) as T);
  } catch (cause) {
    const isTimeout = cause instanceof Error && cause.name === 'TimeoutError';
    return isTimeout
      ? err('TIMEOUT', 'The request took too long.')
      : err('NETWORK', 'Could not reach the service.');
  }
}

export function getJson<T>(url: string, opts?: { headers?: Record<string, string> }): Promise<Result<T>> {
  return run<T>(url, { method: 'GET', headers: baseHeaders(opts?.headers) });
}

export function postForm<T>(url: string, body: Record<string, string>): Promise<Result<T>> {
  return run<T>(url, {
    method: 'POST',
    headers: baseHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' }),
    body: new URLSearchParams(body).toString(),
  });
}
```

- [ ] **Step 9: Run the full suite**

Run: `npm test`
Expected: PASS, 8 tests across 2 files.

- [ ] **Step 10: Commit**

```bash
git add electron/services/
git commit -m "feat: add Result, HTTP, and geo primitives with tests"
```

---

## Task 5: Encrypted secret storage

**Files:**
- Create: `electron/services/secrets.ts`
- Modify: `electron/main.ts`, `electron/preload.ts`, `src/types/flora.d.ts`, `src/screens/SettingsScreen.tsx`, `src/App.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - Main: `readSecret(name: string): string | null`, `writeSecret(name: string, value: string): void`, `deleteSecret(name: string): void`
  - Renderer: `window.flora.secrets.get(name)`, `.set(name, value)`, `.clear(name)` — all `Promise`-based
  - Secret names in use: `'gemini_api_key'`, `'google_refresh_token'`

- [ ] **Step 1: Implement the secret store**

Create `electron/services/secrets.ts`:

```ts
import { app, safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

type Vault = Record<string, string>; // name → base64 of the encrypted buffer

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
    throw new Error('OS encryption unavailable');
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
```

No unit test: every function calls into Electron's `safeStorage`, which needs a live app instance. Coverage comes from the restart check in Step 6.

- [ ] **Step 2: Register the IPC handlers**

In `electron/main.ts`, add the import and extend `registerIpc`:

```ts
import { deleteSecret, readSecret, writeSecret } from './services/secrets';
```

```ts
  ipcMain.handle('flora:secrets:get', (_event, name: unknown) =>
    typeof name === 'string' ? readSecret(name) : null,
  );

  ipcMain.handle('flora:secrets:set', (_event, payload: unknown) => {
    const { name, value } = payload as { name: string; value: string };
    writeSecret(name, value);
  });

  ipcMain.handle('flora:secrets:clear', (_event, name: unknown) => {
    if (typeof name === 'string') deleteSecret(name);
  });
```

- [ ] **Step 3: Expose them on the bridge**

In `electron/preload.ts`, add to the exposed object:

```ts
  secrets: {
    get: (name: string) => invoke<string | null>('flora:secrets:get', name),
    set: (name: string, value: string) => invoke<void>('flora:secrets:set', { name, value }),
    clear: (name: string) => invoke<void>('flora:secrets:clear', name),
  },
```

In `src/types/flora.d.ts`, add the matching member to `FloraApi`:

```ts
  secrets: {
    get(name: string): Promise<string | null>;
    set(name: string, value: string): Promise<void>;
    clear(name: string): Promise<void>;
  };
```

- [ ] **Step 4: Move the API key off localStorage**

In `src/App.tsx`, the init effect currently reads `localStorage.getItem('flora_api_key')`. Replace with a one-time migration:

```ts
      const legacyKey = localStorage.getItem('flora_api_key');
      if (legacyKey) {
        await window.flora.secrets.set('gemini_api_key', legacyKey);
        localStorage.removeItem('flora_api_key');
      }
      const key = (await window.flora.secrets.get('gemini_api_key')) ?? '';
```

- [ ] **Step 5: Persist through the bridge in Settings**

`SettingsScreen`'s `onChangeApiKey` currently writes to `localStorage` inline. In `App.tsx`, define:

```ts
  const changeApiKey = async (value: string) => {
    setUserApiKey(value);
    if (value) await window.flora.secrets.set('gemini_api_key', value);
    else await window.flora.secrets.clear('gemini_api_key');
  };
```

Pass it as the `onChangeApiKey` prop, and remove the `localStorage.setItem` call from the screen. Also drop `flora_api_key` from the `localStorage.clear()` path in the sign-out handler — replace that handler's body with `await window.flora.secrets.clear('gemini_api_key')` followed by the existing reload.

- [ ] **Step 6: Verify the key survives a restart**

Run: `npm run dev:electron`

Enter an API key in Settings, close the window entirely, and relaunch.

Expected: the key is still present, the red "Action Required" banner is gone, and `grep -r "AIza" ~/.config/Electron/` finds nothing — the value on disk is ciphertext.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: store the Gemini API key in OS-encrypted safeStorage"
```

---

## Task 6: PKCE generation

**Files:**
- Create: `electron/services/pkce.ts`, `electron/services/pkce.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `createVerifier(): string`, `challengeFor(verifier: string): string`, `createState(): string`.

- [ ] **Step 1: Write the failing test**

The challenge case uses the worked example from RFC 7636 Appendix B, so a correct implementation is verifiable against the standard rather than against itself.

Create `electron/services/pkce.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run electron/services/pkce.test.ts`
Expected: FAIL — cannot resolve `./pkce`.

- [ ] **Step 3: Implement pkce.ts**

Create `electron/services/pkce.ts`:

```ts
import { createHash, randomBytes } from 'node:crypto';

const base64url = (buffer: Buffer): string => buffer.toString('base64url');

/** 32 random bytes encode to 43 base64url characters — the RFC 7636 minimum. */
export const createVerifier = (): string => base64url(randomBytes(32));

export const challengeFor = (verifier: string): string =>
  base64url(createHash('sha256').update(verifier).digest());

export const createState = (): string => base64url(randomBytes(16));
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run electron/services/pkce.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add electron/services/pkce.ts electron/services/pkce.test.ts
git commit -m "feat: add PKCE verifier and challenge generation"
```

---

## Task 7: OAuth loopback flow

**Files:**
- Create: `electron/services/oauth.ts`, `electron/services/oauth.test.ts`, `electron/oauth-config.example.json`
- Modify: `electron/main.ts`, `electron/preload.ts`, `src/types/flora.d.ts`

**Interfaces:**
- Consumes: `Result`/`ok`/`err` (Task 4), `postForm` (Task 4), `createVerifier`/`challengeFor`/`createState` (Task 6), `writeSecret` (Task 5).
- Produces:
  - `buildConsentUrl(opts: ConsentOpts): string`
  - `parseCallback(rawUrl: string, expectedState: string): Result<{ code: string }>`
  - `signIn(): Promise<Result<GoogleTokens>>` where `GoogleTokens = { idToken: string; accessToken: string }`
  - Renderer: `window.flora.auth.signIn(): Promise<Result<GoogleTokens>>`

- [ ] **Step 1: Write the failing test**

Create `electron/services/oauth.test.ts`:

```ts
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
    const result = parseCallback('/?code=auth-code-1&state=state-abc', 'state-abc');
    expect(result).toEqual({ ok: true, data: { code: 'auth-code-1' } });
  });

  it('rejects a mismatched state without returning a code', () => {
    const result = parseCallback('/?code=auth-code-1&state=wrong', 'state-abc');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('OAUTH_STATE_MISMATCH');
  });

  it('reports a denied consent as a cancellation, not a failure', () => {
    const result = parseCallback('/?error=access_denied&state=state-abc', 'state-abc');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('OAUTH_CANCELLED');
  });

  it('rejects a callback with no code at all', () => {
    const result = parseCallback('/?state=state-abc', 'state-abc');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('OAUTH_EXCHANGE_FAILED');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run electron/services/oauth.test.ts`
Expected: FAIL — cannot resolve `./oauth`.

- [ ] **Step 3: Implement the pure helpers**

Create `electron/services/oauth.ts` with the config type and the two pure functions:

```ts
import { createServer } from 'node:http';
import { shell } from 'electron';
import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { err, ok, Result } from './result';
import { postForm } from './http';
import { challengeFor, createState, createVerifier } from './pkce';
import { writeSecret } from './secrets';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const SCOPES = ['openid', 'email', 'profile'];
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

  const state = url.searchParams.get('state');
  if (!state || state !== expectedState) {
    return err('OAUTH_STATE_MISMATCH', 'Sign-in could not be verified. Try again.');
  }

  const code = url.searchParams.get('code');
  if (!code) return err('OAUTH_EXCHANGE_FAILED', 'No authorization code was returned.');

  return ok({ code });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run electron/services/oauth.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit the tested core**

```bash
git add electron/services/oauth.ts electron/services/oauth.test.ts
git commit -m "feat: add OAuth consent URL builder and callback parser"
```

- [ ] **Step 6: Add config loading**

Append to `electron/services/oauth.ts`:

```ts
type OAuthConfig = { clientId: string; clientSecret: string };

function loadConfig(): OAuthConfig | null {
  // Packaged builds ship the file via electron-builder extraResources.
  const candidates = [
    path.join(process.resourcesPath ?? '', 'oauth-config.json'),
    path.join(__dirname, '../../electron/oauth-config.json'),
  ];

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    try {
      const parsed = JSON.parse(readFileSync(candidate, 'utf8')) as Partial<OAuthConfig>;
      if (parsed.clientId && parsed.clientSecret) {
        return { clientId: parsed.clientId, clientSecret: parsed.clientSecret };
      }
    } catch {
      // Fall through to the next candidate.
    }
  }
  return null;
}
```

Create `electron/oauth-config.example.json`:

```json
{
  "_comment": "Copy to oauth-config.json. Create an OAuth client of type 'Desktop app' in the Google Cloud console, in the same project as firebase-applet-config.json. For installed apps this secret is NOT confidential - it ships inside the binary and is extractable. PKCE is what protects the exchange.",
  "clientId": "REPLACE_ME.apps.googleusercontent.com",
  "clientSecret": "REPLACE_ME"
}
```

- [ ] **Step 7: Implement the loopback listener**

Append to `electron/services/oauth.ts`:

```ts
const DONE_PAGE = `<!doctype html><meta charset="utf-8">
<title>Flora AI</title>
<body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0">
<p>Signed in. You can close this window and return to Flora AI.</p>`;

type Awaited = { redirectUri: string; wait: Promise<Result<{ code: string }>>; close: () => void };

function awaitCallback(state: string): Promise<Awaited> {
  return new Promise((resolveServer) => {
    let settle: (value: Result<{ code: string }>) => void;
    const wait = new Promise<Result<{ code: string }>>((r) => { settle = r; });

    let done = false;
    const finish = (value: Result<{ code: string }>) => {
      if (done) return;           // The listener accepts exactly one callback.
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
    server.on('close', () => clearTimeout(timer));

    // Port 0 lets the OS pick a free port; Google wildcards the port for
    // Desktop-type clients, so nothing needs registering in advance.
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      resolveServer({
        redirectUri: `http://127.0.0.1:${port}`,
        wait,
        close: () => finish(err('OAUTH_CANCELLED', 'Sign-in cancelled.')),
      });
    });
  });
}
```

- [ ] **Step 8: Implement signIn**

Append to `electron/services/oauth.ts`:

```ts
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
  const server = await awaitCallback(state);

  await shell.openExternal(
    buildConsentUrl({
      clientId: config.clientId,
      redirectUri: server.redirectUri,
      challenge: challengeFor(verifier),
      state,
    }),
  );

  const callback = await server.wait;
  if (!callback.ok) return callback;

  const tokens = await postForm<TokenResponse>(TOKEN_ENDPOINT, {
    code: callback.data.code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code_verifier: verifier,
    grant_type: 'authorization_code',
    redirect_uri: server.redirectUri,
  });

  if (!tokens.ok) return err('OAUTH_EXCHANGE_FAILED', "Couldn't complete sign-in. Try again.");

  const { id_token: idToken, access_token: accessToken, refresh_token: refreshToken } = tokens.data;
  if (!idToken || !accessToken) {
    return err('OAUTH_EXCHANGE_FAILED', "Couldn't complete sign-in. Try again.");
  }

  if (refreshToken) writeSecret('google_refresh_token', refreshToken);

  return ok({ idToken, accessToken });
}
```

- [ ] **Step 9: Wire up IPC and the bridge**

In `electron/main.ts`, import `signIn` and add to `registerIpc`:

```ts
  ipcMain.handle('flora:auth:signIn', () => signIn());
```

In `electron/preload.ts`, add to the exposed object:

```ts
  auth: {
    signIn: () => invoke<unknown>('flora:auth:signIn'),
  },
```

In `src/types/flora.d.ts`, add the `Result` shape and the member:

```ts
export type FloraResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export type GoogleTokens = { idToken: string; accessToken: string };
```

```ts
  auth: {
    signIn(): Promise<FloraResult<GoogleTokens>>;
  };
```

- [ ] **Step 10: Package the config file**

In `package.json`, add to the `build` object:

```json
    "extraResources": [
      { "from": "electron/oauth-config.json", "to": "oauth-config.json" }
    ],
```

- [ ] **Step 11: Verify the unconfigured path**

With no `electron/oauth-config.json` present, run `npm run dev:electron`, open DevTools (View → Toggle Developer Tools) and run:

```js
await window.flora.auth.signIn()
```

Expected: `{ ok: false, error: { code: 'OAUTH_NOT_CONFIGURED', … } }`, returned immediately. No browser opens, no port is bound, the app keeps running.

- [ ] **Step 12: Run the full suite and commit**

Run: `npm test`
Expected: PASS, 19 tests across 4 files.

```bash
git add -A
git commit -m "feat: add PKCE loopback sign-in flow with IPC surface"
```

---

## Task 8: Google sign-in in the renderer

**Files:**
- Modify: `src/firebase.ts`, `src/App.tsx`, `src/screens/SettingsScreen.tsx`

**Interfaces:**
- Consumes: `window.flora.auth.signIn()` (Task 7), `ErrorCard` (Task 3).
- Produces: `signInWithGoogleDesktop(): Promise<FloraResult<User>>` exported from `src/firebase.ts`.

- [ ] **Step 1: Replace the blocked popup flow**

In `src/firebase.ts`, delete `signInWithGoogle` and the now-unused `signInWithPopup` and `googleProvider` export. Replace with:

```ts
import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  signInWithCredential,
  signOut,
  User,
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import type { FloraResult } from './types/flora';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Survives an app restart, so the user consents once rather than every launch.
void setPersistence(auth, browserLocalPersistence);

/**
 * Google blocks OAuth inside embedded user agents, and an Electron window is
 * detected as one — signInWithPopup fails with disallowed_useragent. The main
 * process runs a PKCE loopback through the real browser instead, and hands the
 * tokens back here. signInWithCredential opens no window, so it works.
 */
export const signInWithGoogleDesktop = async (): Promise<FloraResult<User>> => {
  const tokens = await window.flora.auth.signIn();
  if (!tokens.ok) return tokens;

  try {
    const credential = GoogleAuthProvider.credential(tokens.data.idToken, tokens.data.accessToken);
    const result = await signInWithCredential(auth, credential);
    return { ok: true, data: result.user };
  } catch {
    return { ok: false, error: { code: 'OAUTH_EXCHANGE_FAILED', message: "Couldn't complete sign-in. Try again." } };
  }
};

export const logout = async (): Promise<void> => {
  await signOut(auth);
};
```

- [ ] **Step 2: Add the sign-in handler to App.tsx**

`currentUser` and the `onAuthStateChanged` subscription already exist and stay. Add:

```ts
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async () => {
    setAuthError(null);
    setIsSigningIn(true);
    const result = await signInWithGoogleDesktop();
    // A cancellation is a normal choice, not an error worth showing.
    if (!result.ok && result.error.code !== 'OAUTH_CANCELLED') {
      setAuthError(result.error.message);
    }
    setIsSigningIn(false);
  };
```

Pass `currentUser`, `authError`, `isSigningIn`, `onSignIn={handleSignIn}`, and the existing `onSignOut` into `SettingsScreen`.

- [ ] **Step 3: Add the account panel to Settings**

In `src/screens/SettingsScreen.tsx`, add above the API-key section:

```tsx
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-[var(--color-accent)] uppercase tracking-widest">Account</h3>
          <div className="bg-bg-card dynamic-border rounded-[var(--radius-dynamic)] p-5 space-y-4 shadow-sm">
            {currentUser ? (
              <div className="flex items-center gap-3">
                {currentUser.photoURL && (
                  <img src={currentUser.photoURL} alt="" className="w-10 h-10 rounded-full" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-text-main truncate">{currentUser.displayName}</p>
                  <p className="text-xs text-text-muted truncate">{currentUser.email}</p>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs text-text-muted leading-relaxed font-medium">
                  Optional. Signing in opens your web browser. Flora AI works fully without it — your
                  plants are stored on this computer either way.
                </p>
                <button
                  onClick={onSignIn}
                  disabled={isSigningIn}
                  className="w-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/30 py-3 rounded-xl font-bold text-sm hover:bg-[var(--color-accent)]/20 transition-colors disabled:opacity-50"
                >
                  {isSigningIn ? 'Waiting for your browser…' : 'Sign in with Google'}
                </button>
              </>
            )}
            {authError && <ErrorCard message={authError} onRetry={onSignIn} />}
          </div>
        </div>
```

- [ ] **Step 4: Verify the app runs unconfigured**

Run: `npm run dev:electron`, open Settings, click Sign in with Google.

Expected: the inline error reads "Google sign-in is not configured." Every other feature still works. This is the state a grader sees if they never create an OAuth client.

- [ ] **Step 5: Verify the configured flow**

Create `electron/oauth-config.json` from the example, filling in a real Desktop-app client ID and secret. Restart and click Sign in with Google.

Expected: the system browser opens Google's consent page; approving it shows "Signed in. You can close this window"; the app's Settings panel shows your name, email, and avatar. Fully quit and relaunch — you are still signed in.

- [ ] **Step 6: Verify cancellation is harmless**

Click Sign in, then close the browser tab without approving.

Expected: no error appears, the button returns to its normal state after the 5-minute timeout at the latest, and the app stays usable throughout.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add optional Google sign-in via desktop loopback"
```

---

## Task 9: Package for Linux and Windows

**Files:**
- Create: `.github/workflows/build.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: `release/*.AppImage`, `release/*.deb`, `release/*.exe`.

- [ ] **Step 1: Build the Linux artifacts**

Run: `npm run dist:linux`

Expected: `release/Flora AI-1.0.0.AppImage` and `release/flora-ai_1.0.0_amd64.deb`.

- [ ] **Step 2: Verify the AppImage runs**

```bash
chmod +x "release/Flora AI-1.0.0.AppImage"
"./release/Flora AI-1.0.0.AppImage"
```

Expected: the app launches from the packaged bundle. Confirm the API key persists, themes switch, and a scan completes.

- [ ] **Step 3: Add the CI workflow for Windows**

Building the `.exe` from Linux needs wine and is unreliable. CI produces both from one push.

Create `.github/workflows/build.yml`:

```yaml
name: Build desktop apps

on:
  push:
    branches: [master]
  workflow_dispatch:

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: ubuntu-latest
            script: dist:linux
            artifact: linux
          - os: windows-latest
            script: dist:win
            artifact: windows
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run ${{ matrix.script }}
      - uses: actions/upload-artifact@v4
        with:
          name: flora-ai-${{ matrix.artifact }}
          path: |
            release/*.AppImage
            release/*.deb
            release/*.exe
```

CI has no `oauth-config.json`, so `extraResources` must tolerate its absence. In `package.json`, change the entry added in Task 7 Step 10 to:

```json
    "extraResources": [
      { "from": "electron/oauth-config.json", "to": "oauth-config.json", "filter": ["**/*"] }
    ],
```

Verify with `npm run dist:linux` after temporarily renaming `electron/oauth-config.json` — the build must still succeed, and the resulting app must report `OAUTH_NOT_CONFIGURED` rather than crashing.

- [ ] **Step 4: Rewrite the README**

Replace `README.md` — the current text is the AI Studio boilerplate and describes neither this app nor a desktop build. Cover: what Flora AI is, prerequisites (Node 20+), `npm install`, `npm run dev:electron`, `npm test`, `npm run dist:linux` / `dist:win` with the wine caveat, where to get a Gemini API key, and how to create the OAuth Desktop client for `electron/oauth-config.json` including the note that the secret is not confidential for installed apps.

- [ ] **Step 5: Run the full verification pass**

Run: `npm test && npm run lint`
Expected: all tests pass, no type errors.

Then in the packaged AppImage, walk: onboarding → home → settings (API key, all three themes, sign-in) → scan an image → save to garden → open plant → check in → chat → history → back from each screen. Confirm no paywall appears anywhere and no `alert()` fires.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: package for Linux and Windows, add CI matrix build"
```

---

## Self-Review

**Spec coverage.** §3 architecture → Tasks 1, 3, 4. §4 data model → deferred to plan 2, which owns every new type. §8 paywall removal → Task 2 in full, including the verification grep. §9 OAuth loopback → Tasks 6, 7, 8 covering all seven flow steps, the optional-not-a-gate rule, and configuration. §10 error handling → `Result` in Task 4, OAuth codes in Task 7, `ErrorCard` in Task 3; the network-specific codes belong to plan 2's services. §11 security → Task 1 (isolation, CSP, navigation guards), Task 5 (`safeStorage`), Task 7 (PKCE `S256`, `127.0.0.1` binding, single-use listener, timeout). §12 testing → Tasks 4, 6, 7; the parser tests arrive with their parsers in plan 2. §13 build → Tasks 1 and 9. §14 steps 1-5 → Tasks 1-8; steps 6-11 → plan 2.

**Deferred to plan 2, deliberately:** webcam capture, the extended identification schema, the four action cards, the nursery finder, the wild screen, and the `geocode`/`nurseries`/`gbif` services. Task 2 adds the `'nurseries'` nav button ahead of its screen so the nav is not restructured twice; clicking it before plan 2 renders nothing.

**Type consistency.** `Result<T>` is defined once in Task 4 and mirrored for the renderer as `FloraResult<T>` in Task 7 Step 9, matching field for field. `haversineKm` takes `Coord` throughout. Secret names are the string literals `'gemini_api_key'` and `'google_refresh_token'` in Tasks 5 and 7. `GoogleTokens` is `{ idToken, accessToken }` in both `oauth.ts` and `flora.d.ts`. The IPC channel names in `main.ts` and `preload.ts` match: `flora:openExternal`, `flora:secrets:get|set|clear`, `flora:auth:signIn`.

**One known rough edge.** Task 7 Step 7's `close()` is exposed but never called, because nothing currently cancels a pending sign-in from the app side — the timeout handles the abandoned case. Plan 2 can wire it to a Cancel button; leaving it unused is intentional, not an oversight.
