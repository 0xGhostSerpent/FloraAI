# Flora AI

A desktop plant identification and care app for Linux and Windows. Photograph a plant and Flora AI
identifies it, assesses its health, warns about toxicity, and lets you keep a garden of plants you
check in on over time — each with an AI avatar you can talk to.

Built for the DIU Desktop & Web Programming course project (group CtRL+CreAtE).

## What it does

Photograph a plant with your webcam or upload an image, and after identification you can:

| Action | What you get |
|---|---|
| **Add to Garden** | Track the plant and check in on it over time, building a photo history and a streak |
| **Plant Status** | A structured read on hydration, leaf condition and light, with one concrete next action |
| **Where to Buy** | Real nurseries near you on a map, with an estimated price and a Google Maps link each |
| **Find in the Wild** | Real recorded sightings from GBIF, plus native range, habitat and season |

Two things the app deliberately does *not* claim:

- **Stock is never invented.** OpenStreetMap holds no inventory data, so availability is derived from
  the map tag alone — garden centres read "Likely stocked", florists "Call ahead" — and every result
  carries "Availability not verified".
- **Prices are estimates, not quotes.** They come from the AI model, are labelled as such on screen,
  and are cached for 30 days.

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
  components/ui    Buttons, cards, fields, dialogs: every screen is built from these
  components/      Sidebar, map
  index.css        Design tokens and the Fern, Clay and Night themes
  store.ts         IndexedDB persistence via idb-keyval
```

The renderer is sandboxed with `contextIsolation` on and `nodeIntegration` off; it reaches Node only
through the `window.flora` bridge. Your Gemini API key and OAuth refresh token are encrypted by the
operating system (Electron `safeStorage`), never plaintext on disk.

## Data sources

Every external source is keyless and needs no billing account. Nursery, geocoding and occurrence
lookups run in the Electron main process, because Nominatim rejects browser-origin requests and
Overpass and GBIF apply CORS restrictions.

| Source | Used for |
|---|---|
| [Google Gemini](https://ai.google.dev/) | Identification, health assessment, price estimates, habitat notes, plant chat |
| [OpenStreetMap Overpass](https://overpass-api.de/) | Nearby garden centres, nurseries and florists |
| [Nominatim](https://nominatim.openstreetmap.org/) | Turning a city or postcode into coordinates |
| [ipapi.co](https://ipapi.co/) | Coarse fallback location — desktops have no GPS |
| [GBIF](https://www.gbif.org/) | Real wild occurrence records, filtered to genuine field observations |
| [Leaflet](https://leafletjs.com/) + OSM tiles | The in-app maps |

Map data © OpenStreetMap contributors. Occurrence data from GBIF.

Nursery searches are cached, so a failed lookup falls back to the last saved results rather than
showing nothing.

## Licence and disclaimer

Coursework project. AI identification is informational only — **do not ingest or handle any plant
based on this app's output.**
