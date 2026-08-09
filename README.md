# Flora AI

A desktop plant identification and care app for Linux and Windows. Photograph a plant and Flora AI
identifies it, assesses its health, warns about toxicity, and lets you keep a garden of plants you
check in on over time — each with an AI avatar you can talk to.

Built for the DIU Desktop & Web Programming course project (group CtRL+CreAtE).

## Requirements

- **Node.js 20 or newer**
- A **Gemini API key** from [Google AI Studio](https://aistudio.google.com/apikey) — enter it in
  Settings on first run. Every AI feature needs it.

## Running it

```bash
npm install
npm run dev:electron     # dev, with hot reload
npm start                # production build, run locally
npm test                 # unit tests
npm run lint             # type-check both the renderer and main process
```

## Building installers

```bash
npm run dist:linux       # AppImage + .deb  → release/
npm run dist:win         # NSIS .exe        → release/
```

**Building the Windows `.exe` from Linux requires wine and is unreliable.** Use the GitHub Actions
workflow in `.github/workflows/build.yml`, which builds both platforms from one push, or run
`npm run dist:win` on a Windows machine.

## Google sign-in (optional)

Sign-in is entirely optional — every feature works without it, and your plants are stored on this
computer either way. If `electron/oauth-config.json` is absent, the button simply renders disabled.

To enable it:

1. In the [Google Cloud console](https://console.cloud.google.com/apis/credentials), create an OAuth
   client of type **Desktop app**, in the same project as `firebase-applet-config.json`.
2. Copy `electron/oauth-config.example.json` to `electron/oauth-config.json` and fill in the client
   ID and secret.

Consent opens in your real browser and the app catches the redirect on a loopback port. This is
necessary rather than decorative: Google blocks OAuth inside embedded user agents, and an Electron
window counts as one, so Firebase's `signInWithPopup` fails with `disallowed_useragent`.

> For installed applications the client secret is **not confidential** — it ships inside the binary
> and can be extracted. This is expected and documented by Google; PKCE, not the secret, is what
> protects the exchange. `oauth-config.json` is gitignored regardless.

## Architecture

```
electron/          Main process — no CORS restrictions, holds all network and secret handling
  main.ts          Window, CSP, navigation guards, IPC
  preload.ts       contextBridge → window.flora.*
  services/        result, http, geo, secrets, pkce, oauth
src/               React 19 renderer
  App.tsx          Routing and shared state
  screens/         One component per screen
  components/      Shared UI
  store.ts         IndexedDB persistence via idb-keyval
```

The renderer is sandboxed with `contextIsolation` on and `nodeIntegration` off; it reaches Node only
through the `window.flora` bridge. Your Gemini API key and OAuth refresh token are encrypted by the
operating system (Electron `safeStorage`), never plaintext on disk.

## Data sources

Plant identification, health assessment, and chat use **Google Gemini**.

## Licence and disclaimer

Coursework project. AI identification is informational only — **do not ingest or handle any plant
based on this app's output.**
