# Flora AI — Desktop App Design

**Date:** 2026-08-09
**Project:** AI Plant Identification System (Course project, DIU — Desktop & Web Programming)
**Status:** Approved design, pending implementation plan

---

## 1. Context

The repository currently holds two things:

- **`src/`** — a working React 19 + Vite + Tailwind 4 application. A single 808-line `App.tsx` handles all state and rendering. Data persists to IndexedDB via `idb-keyval` (`src/store.ts`). Gemini is called directly from the browser using an API key the user pastes into Settings. Firebase provides Google sign-in.
- **`flutter_app/`** — a non-functional skeleton. `storage_service.dart` returns hardcoded literals, `ai_service.dart` is a prompt string inside a comment, and no `linux/` or `windows/` platform directories exist.

The React app is the real program. The Flutter directory is scaffolding.

### Goals

1. Ship the app as an installable **Linux and Windows desktop application**.
2. **Remove the paywall** entirely — every feature free and always reachable.
3. After a plant photo is captured, offer four actions: **add to garden**, **plant status**, **where to buy**, **where to find in the wild**.
4. Deliver the proposal's Feature #7 — **Plant Marketplace & Nursery Finder**: nearby nurseries, estimated price, availability, and Google Maps location.

### Non-goals

Mobile builds, real e-commerce or checkout, live inventory integration with actual retailers, offline AI inference, multi-user accounts or a shared server backend.

---

## 2. Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Desktop shell | **Electron** + `electron-builder` | Reuses 100% of the working React app. Grants real webcam access. The Node main process has no CORS restrictions, which the external APIs require. Cost: ~100 MB installers. |
| Nursery data | **OpenStreetMap Overpass** | Real nearby places, no API key, no billing account. Google Places would need a card on file. |
| Geocoding | **Nominatim**, IP fallback | Keyless. Desktops have no GPS, so manual entry is more accurate than any automatic method anyway. |
| Wild occurrence data | **GBIF** | Free, keyless, scientifically citable — real recorded sightings with coordinates. |
| Maps | **Leaflet + OSM tiles** in-app; **Google Maps deep link** out | Keyless inline map, and the deep link satisfies the proposal's Google Maps requirement without billing. |
| Paywall | **Deleted** | Per requirement. Also removes the only thing Firebase auth gated. |
| `flutter_app/` | **Deleted** | Non-functional, and `paywall_screen.dart` contradicts the paywall removal. |
| Firebase auth | **Kept, re-implemented as a desktop OAuth loopback** | `signInWithPopup` is blocked in Electron (§9). The PKCE loopback through the system browser is Google's supported installed-app flow. Sign-in becomes optional rather than an entry gate. |

### Deviations from the submitted proposal

Both are defensible in the final report, but must be stated there rather than glossed over:

1. **Desktop technology: Flutter → Electron.** The Flutter directory was never a working application; completing it meant rewriting the entire app in Dart.
2. **Core module #5 "Subscription / Paywall" is removed.** The application is free in full.

Firebase Authentication is **retained** but re-implemented (§9), and it no longer gates entry to the
app — the proposal's module #1 still holds, with a changed mechanism.

---

## 3. Architecture

```
electron/
  main.ts              BrowserWindow, app lifecycle, IPC registration
  preload.ts           contextBridge → window.flora.*
  tsconfig.json        compiles to dist-electron/
  services/
    http.ts            fetch wrapper: timeout, User-Agent, typed Result
    geocode.ts         Nominatim forward geocode + IP fallback
    nurseries.ts       Overpass query, parse, haversine sort
    gbif.ts            species match + occurrence search
    secrets.ts         safeStorage-encrypted Gemini key + refresh token
    geo.ts             haversine, pure helpers
    pkce.ts            code verifier/challenge, state (pure)
    oauth.ts           loopback server, consent URL, token exchange
src/
  App.tsx              routing + top-level state (~200 lines)
  screens/
    HomeScreen.tsx       garden grid, streak, status card
    ScannerScreen.tsx    webcam or file capture, preview, analyze
    ScanResultScreen.tsx identification + the four action cards
    StatusScreen.tsx     structured health assessment
    NurseryScreen.tsx    nursery list + Leaflet map + price
    WildScreen.tsx       GBIF map, stats, AI habitat summary
    ChatScreen.tsx       plant avatar chat (existing behaviour)
    HistoryScreen.tsx    check-in grid (existing behaviour)
    SettingsScreen.tsx   API key, theme, location, reset
  components/
    MapView.tsx          shared Leaflet wrapper
    ErrorCard.tsx        inline error + retry
  services/
    ai.ts                all Gemini calls, extracted from App.tsx
  hooks/
    useCamera.ts         getUserMedia lifecycle
  store.ts               IndexedDB types and accessors
```

**Why services live in the main process:** Nominatim requires a descriptive `User-Agent` and rejects browser-origin requests; Overpass and GBIF apply CORS and rate limits that are awkward from a renderer. Node has neither constraint, and centralising them there gives one place for timeouts, caching, and retry.

**Why `App.tsx` gets split:** it is 808 lines today and this design adds four screens. Left monolithic it exceeds 1,500 lines, at which point neither a human nor an agent can edit it reliably. Each screen becomes a component receiving props and callbacks; `App.tsx` retains routing and shared state only.

---

## 4. Data model

Extensions to `src/store.ts`. Existing records must keep loading, so every new field on `PlantData` is optional.

```ts
type PlantData = {
  // ...existing fields unchanged...
  scientificName?: string;   // NEW — required for GBIF matching
  confidence?: number;       // NEW — 0..1 identification confidence
  status?: PlantStatus;      // NEW — structured health assessment
};

type PlantStatus = {
  overall: 'healthy' | 'stressed' | 'declining' | 'unknown';
  hydration: string;
  leafCondition: string;
  lightAdequacy: string;
  recommendedAction: string;
  assessedAt: number;
};

type UserLocation = {
  label: string;             // "Dhaka, Bangladesh"
  lat: number;
  lon: number;
  countryCode?: string;      // drives price currency
  source: 'manual' | 'ip';
};

type Nursery = {
  id: string;                // "node/123456"
  name: string;
  lat: number;
  lon: number;
  distanceKm: number;
  address?: string;
  phone?: string;
  website?: string;
  openingHours?: string;
  kind: 'garden_centre' | 'nursery' | 'florist' | 'plant_nursery';
  availability: 'likely' | 'call_ahead' | 'unknown';
};

type PriceEstimate = {
  scientificName: string;
  currency: string;          // ISO 4217
  small: { min: number; max: number };
  medium: { min: number; max: number };
  large: { min: number; max: number };
  note: string;
  fetchedAt: number;
};

type SpeciesMatch = {
  usageKey: number;
  scientificName: string;
  rank: string;
  family?: string;
  matchConfidence: number;
};

type Occurrence = {
  lat: number;
  lon: number;
  country?: string;
  countryCode?: string;
  year?: number;
  basisOfRecord: string;
};

type OccurrenceSet = {
  total: number;             // GBIF's full count, not the page size
  records: Occurrence[];
  topCountries: { country: string; count: number }[];
  nearestKm?: number;        // to the user's stored location
};
```

**New IndexedDB keys:** `flora_location` (`UserLocation`), `flora_price_cache` (`Record<string, PriceEstimate>`).

**Removed localStorage keys:** `flora_premium`, `flora_install_date`.

**Migration:** none required. Plants saved before this change have no `scientificName`; GBIF matching falls back to the common `name`, and if that fails the Wild screen shows its no-match state.

---

## 5. Capture and the four actions

### Capture

`ScannerScreen` offers two sources:

- **Webcam** — `useCamera` hook wrapping `getUserMedia({ video: true })`, live `<video>` preview, capture to `<canvas>` → data URL. Stream tracks stopped on unmount and on navigation away; failure to stop is the classic Electron camera-light-stays-on bug.
- **File** — the existing `<input type="file">` path, minus the `capture="environment"` attribute, which is meaningless on desktop.

Both produce the same data URL and the same preview.

### Identification

One Gemini call on "Analyze". The response schema extends the current one at `App.tsx:207-219` with two fields:

```
name, scientificName, confidence, careInstructions, healthStatus,
personality, isToxic, toxicityDetails, toxicAlertLevel
```

`scientificName` is load-bearing — GBIF matching and price estimation both key off it.

The existing toxicity alert behaviour is preserved: `isToxic` triggers the red interstitial before results are shown.

### The four actions

`ScanResultScreen` renders the identification, then four cards:

1. **Add to Garden** — existing `savePlantData` path. Persists to IndexedDB, updates the streak, returns Home.
2. **Plant Status** — a second Gemini call returning the structured `PlantStatus`, rendered as labelled rows with the recommended action emphasised. Stored on the plant if it is later added to the garden.
3. **Where to Buy** — pushes `NurseryScreen` scoped to this species.
4. **Find in the Wild** — pushes `WildScreen` scoped to this species.

Actions 3 and 4 do not require the plant to be in the garden. The same four actions are also reachable from a saved plant's detail view.

---

## 6. Nursery finder

### Location resolution

Ordered fallback, first success wins:

1. Stored `flora_location`.
2. User-entered city or postcode → `GET https://nominatim.openstreetmap.org/search?q=<query>&format=json&limit=1&addressdetails=1`, with `User-Agent: FloraAI/1.0 (student project)`. Nominatim's usage policy caps this at one request per second; the app geocodes only on explicit user action, well inside that.
3. `GET https://ipapi.co/json/` → `latitude`, `longitude`, `city`, `country_name`, `country_code`. Keyless, coarse, city-level.

The resolved location is stored and editable in Settings.

### Nursery query

`POST https://overpass-api.de/api/interpreter`:

```
[out:json][timeout:25];
(
  node["shop"~"garden_centre|florist|nursery"](around:{RADIUS},{LAT},{LON});
  way ["shop"~"garden_centre|florist|nursery"](around:{RADIUS},{LAT},{LON});
  node["landuse"="plant_nursery"](around:{RADIUS},{LAT},{LON});
  way ["landuse"="plant_nursery"](around:{RADIUS},{LAT},{LON});
);
out center tags;
```

`out center` is required — ways carry no direct coordinates, only a computed centre. Radius defaults to 15 km, adjustable 5–50 km in the UI.

Parsing pulls `name`, `addr:*`, `phone` or `contact:phone`, `website` or `contact:website`, and `opening_hours`. Elements without a `name` are dropped. Distance is haversine from the user's location; results sort nearest-first.

### Price

One Gemini call per species, keyed by `scientificName` in `flora_price_cache` with a **30-day TTL**. The prompt supplies the user's country so the estimate returns in local currency. Rendered as three size bands with a permanent caption: *"AI estimate — not a quote from any seller."*

### Availability

OpenStreetMap carries no stock data, and this design does not invent any. The badge is derived from the OSM tag alone:

- `garden_centre`, `nursery`, `plant_nursery` → **"Likely stocked"**
- `florist` → **"Call ahead"**
- anything else → **"Unknown"**

Every card carries *"Availability not verified — call to confirm."* Fabricated stock counts are the one element of this feature a grader could demonstrably falsify, so they are excluded.

### Maps

- **Inline:** Leaflet with `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`, pins for every result, user location marked distinctly. The *"© OpenStreetMap contributors"* attribution is required by the tile usage policy and must remain visible.
- **Outbound:** each card's "Open in Google Maps" calls `shell.openExternal('https://www.google.com/maps/search/?api=1&query=<lat>,<lon>')`. This satisfies the proposal's Google Maps requirement with no key and no billing.

---

## 7. Find in the wild

Two GBIF calls, both keyless:

1. `GET https://api.gbif.org/v1/species/match?name=<scientificName>` → `usageKey`, `matchType`, `confidence`, `rank`, `family`. `matchType: "NONE"` means no match.
2. `GET https://api.gbif.org/v1/occurrence/search?taxonKey=<key>&hasCoordinate=true&hasGeospatialIssue=false&limit=300`

Records are filtered to genuine wild sightings — `HUMAN_OBSERVATION`, `OBSERVATION`, `MACHINE_OBSERVATION`. `LIVING_SPECIMEN` is excluded because it largely represents botanical-garden accessions, which is the opposite of what "in the wild" means here.

The screen shows a Leaflet map of sightings, GBIF's total count (not the 300-record page size), the top countries by count, the nearest recorded sighting to the user, and a Gemini-written habitat, native-range, and season summary.

**Empty state matters.** Cultivated houseplants frequently have zero wild records. That case renders *"No verified wild records in GBIF — this species is primarily cultivated"* alongside the AI native-range text, never a blank map.

---

## 8. Paywall removal

Deleted from `src/App.tsx`:

- the `paywall` screen block (lines 693–717)
- the forced redirect (lines 384–386)
- `isPremium`, `installDate`, `getIsTrialActive`, `canAccessApp`, `handlePaywallSuccess`, `cardDetails`
- the paywall gate inside `handleCameraCapture` (lines 164–167)
- the "Pro" bottom-nav button (lines 797–800) and the "Upgrade to Premium" button in Settings (lines 763–767)
- the `'paywall'` member of the `currentScreen` union
- now-unused `CreditCard` and `Sparkles` imports

Deleted elsewhere: `flora_premium` and `flora_install_date` localStorage keys, and the entire `flutter_app/` directory.

Bottom navigation becomes **Garden / Scan / Nurseries**.

**Verification:** `grep -ri "premium\|paywall\|trial\|subscri" src/ electron/` returns nothing.

---

## 9. Google sign-in via desktop OAuth loopback

Google blocks OAuth inside embedded user agents, and an Electron `BrowserWindow` is detected as one — `signInWithPopup` fails with `disallowed_useragent`, and `signInWithRedirect` fails identically. The current onboarding at `App.tsx:426-434` gates entry behind exactly that call, so shipping it unchanged produces an app nobody can get past the first screen of.

The supported path for installed applications is the **loopback redirect with PKCE**: consent happens in the user's real browser, and the app catches the redirect on a local port.

### Flow

1. `pkce.ts` generates a `code_verifier` (43–128 chars, base64url), its `code_challenge` (base64url of the SHA-256 digest), and a random `state`.
2. `oauth.ts` starts an HTTP server bound to **`127.0.0.1` on port `0`**, letting the OS assign a free port. Google permits any port for loopback redirects on Desktop-type clients, so no port needs registering in advance.
3. `shell.openExternal` opens the system browser at `https://accounts.google.com/o/oauth2/v2/auth` with `client_id`, `redirect_uri=http://127.0.0.1:<port>`, `response_type=code`, `scope=openid email profile`, `code_challenge`, `code_challenge_method=S256`, and `state`.
4. The user consents in their own browser. Google redirects to `http://127.0.0.1:<port>/?code=…&state=…`.
5. The listener validates `state`, serves a small "You can close this window" HTML page, and shuts down. A second callback on the same server is rejected.
6. The code is exchanged at `https://oauth2.googleapis.com/token` (POST, form-encoded: `code`, `client_id`, `client_secret`, `code_verifier`, `grant_type=authorization_code`, `redirect_uri`) for `id_token`, `access_token`, and `refresh_token`.
7. The `id_token` and `access_token` cross IPC to the renderer, which calls
   `signInWithCredential(auth, GoogleAuthProvider.credential(idToken, accessToken))`.

Step 7 is what keeps Firebase in the picture: `signInWithCredential` opens no window, so it works in Electron where the popup flows do not. The result is a genuine Firebase `User` — the rest of the Firebase SDK behaves exactly as the proposal describes.

Persistence uses `browserLocalPersistence` so the session survives restarts. The `refresh_token` is stored through `secrets.ts` (§11) so a lapsed session can be renewed without a second consent prompt.

### Sign-in is optional, not a gate

Onboarding becomes the liability disclaimer plus "Accept & Continue". Sign-in moves to Settings, showing the account's name, email, and avatar once connected.

This matters for reliability: OAuth has several failure modes the app does not control — no client configured, no network, the user closing the browser tab. If entry were gated behind it, any one of those would render the app unusable. Every feature works signed out; all data is local to IndexedDB regardless.

The simulated "Google Drive Sync" is still removed — `triggerDriveSync` at `App.tsx:123-130` is a `setTimeout` that shows a toast, not a backup. Real Drive sync would need the `https://www.googleapis.com/auth/drive.appdata` scope added at step 3; the loopback gives you that hook, but it is out of scope here.

### Configuration

Requires an OAuth client of type **Desktop app** from the Google Cloud console, supplying a client ID and client secret. Values live in `electron/oauth-config.json`, gitignored, with `oauth-config.example.json` committed.

For installed applications this "secret" is **not confidential** — it ships inside the binary and is extractable. That is expected and documented by Google; PKCE, not the secret, is what actually protects the exchange. The spec states this plainly rather than implying the value is protected.

**If the file is absent the app still runs.** The Settings button renders disabled with "Google sign-in not configured", and nothing else changes.

---

## 10. Error handling

Every main-process service returns a discriminated union:

```ts
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };
```

All network calls carry a 10-second `AbortSignal.timeout`. Renderer failures render `ErrorCard` inline with a retry button — never `alert()`, which the current code uses at `App.tsx:250` and `App.tsx:148`.

| Condition | Code | User-facing message |
|---|---|---|
| Overpass rate limit (429) | `OVERPASS_BUSY` | "Nursery service is busy. Try again in a moment." |
| Overpass timeout | `OVERPASS_TIMEOUT` | "Search took too long. Try a smaller radius." |
| No nurseries found | `NO_RESULTS` | "No nurseries found within {radius} km. Try widening the search." |
| Geocode miss | `GEOCODE_NONE` | "Couldn't find that place. Try a city name." |
| GBIF no match | `SPECIES_NO_MATCH` | Falls through to the cultivated-species empty state. |
| Missing Gemini key | `NO_API_KEY` | Existing Settings banner. |
| Offline | `OFFLINE` | "You're offline. Showing last saved results." |
| No `oauth-config.json` | `OAUTH_NOT_CONFIGURED` | Button disabled: "Google sign-in not configured." |
| User denied consent | `OAUTH_CANCELLED` | "Sign-in cancelled." No error styling — this is a normal choice. |
| No callback in 5 min | `OAUTH_TIMEOUT` | "Sign-in timed out. Try again." Listener closes. |
| `state` mismatch | `OAUTH_STATE_MISMATCH` | "Sign-in could not be verified. Try again." |
| Token exchange failed | `OAUTH_EXCHANGE_FAILED` | "Couldn't complete sign-in. Try again." |

Nursery and occurrence responses are cached in IndexedDB keyed by rounded coordinates so the offline path has something to show.

---

## 11. Security

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. The renderer touches Node only through the `contextBridge` surface in `preload.ts`.
- `shell.openExternal` accepts `https:` URLs only; everything else is rejected before the call.
- A `will-navigate` handler blocks in-app navigation away from the bundled app.
- A Content-Security-Policy header permits `self`, the OSM tile host, the Gemini endpoint, and the Firebase auth endpoints `identitytoolkit.googleapis.com` and `securetoken.googleapis.com` — nothing else. The Google consent page is never loaded in-app, so `accounts.google.com` is deliberately absent.
- **The Gemini API key moves to `safeStorage`.** It currently lives in plaintext `localStorage` (`App.tsx:728`), which in a desktop app is a readable file on disk. `secrets.ts` encrypts it with the OS keychain and exposes get/set/clear over IPC. Roughly 30 lines, and a solid paragraph for the report's security section. The OAuth `refresh_token` is stored the same way.

OAuth-specific hardening, all in `oauth.ts`:

- **PKCE `S256` is mandatory** — the `plain` method is never offered.
- The loopback server binds to **`127.0.0.1`, never `0.0.0.0`**, so no other host on the network can reach it.
- `state` is compared before the code is exchanged; a mismatch aborts without contacting the token endpoint.
- The listener accepts **one** callback, then closes. It also closes on a 5-minute timeout, so a cancelled sign-in leaves no port open.
- Tokens travel over IPC and are never written to `localStorage` or logged.

---

## 12. Testing

Vitest, targeting the pure functions in `electron/services` — no Electron runtime needed:

- `haversineKm` — known city pairs, identical points, antipodes
- `buildOverpassQuery` — snapshot for given lat/lon/radius
- `parseOverpass` — nodes, ways with `center`, missing `name` dropped, tag variants (`phone` vs `contact:phone`)
- `availabilityBadge` — every tag → badge mapping
- `parseOccurrences` — `basisOfRecord` filtering, `topCountries` aggregation, missing coordinates dropped
- `resolveLocation` — the full fallback chain with mocked fetch, including "all sources fail"
- `isPriceCacheFresh` — inside TTL, past TTL, missing entry
- `Result` propagation — timeout and non-200 produce `ok: false`, never throw
- `pkce` — verifier length and charset; challenge derivation checked against the RFC 7636 test vector (`dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk` → `E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM`); two calls never produce the same verifier
- `parseCallback` — success (`code` + `state`), `error=access_denied`, missing params, mismatched `state`
- `buildConsentUrl` — every required parameter present and correctly encoded

**Manual smoke checklist**, run on both platforms before submission: webcam capture, file capture, identify, each of the four actions, nursery search at two radii, Google Maps deep link opens the system browser, wild map renders, cultivated-plant empty state, offline behaviour, API key survives a restart, and a full pass confirming no paywall appears anywhere.

Sign-in additions to that checklist: consent completes in the system browser and the app reflects the account; cancelling in the browser leaves the app usable; the session survives a restart; sign-out clears it; and with `oauth-config.json` absent the app still runs with the button disabled.

---

## 13. Build and packaging

`electron/` compiles with its own `tsconfig.json` to `dist-electron/`. In development the main process loads `VITE_DEV_SERVER_URL`; in production it loads the built `dist/index.html`.

Scripts:

```
dev:electron    vite dev server + electron, concurrently
build:electron  tsc electron/ && vite build
dist:linux      electron-builder --linux AppImage deb
dist:win        electron-builder --win nsis
```

`electron-builder` configuration: `appId: com.ctrlcreate.floraai`, product name "Flora AI", packaging `dist/**` and `dist-electron/**`, Linux category Education. `electron/oauth-config.json` ships via `extraResources`; `main.ts` reads it from `process.resourcesPath` in production and from the source tree in development, treating absence as `OAUTH_NOT_CONFIGURED` rather than a crash.

**Windows build constraint:** producing the `.exe` from Linux requires wine, which is unreliable. Build Windows artifacts on a Windows machine, or use a GitHub Actions matrix (`ubuntu-latest` + `windows-latest`) — the CI route is recommended and produces both artifacts from one push. Linux artifacts build locally without additional tooling.

---

## 14. Implementation order

1. Electron shell — main, preload, dev/prod loading, packaging config. App runs in a window, unchanged.
2. Paywall removal and `flutter_app/` deletion. Onboarding drops to disclaimer plus Continue, and the blocked `signInWithPopup` call is removed — sign-in returns in step 5.
3. `App.tsx` split into `screens/`. Behaviour-preserving refactor with the manual smoke pass as the check.
4. Main-process services with their unit tests: `http`, `geo`, `geocode`, `nurseries`, `gbif`, `secrets`.
5. OAuth loopback — `pkce.ts`, `oauth.ts`, config loading, IPC surface, `signInWithCredential` in the renderer, Settings account panel.
6. Capture rework — webcam via `useCamera`, extended identification schema.
7. `ScanResultScreen` with the four action cards; Add to Garden and Plant Status wired.
8. `NurseryScreen` — location prompt, Overpass results, Leaflet map, price, availability, Maps deep link.
9. `WildScreen` — GBIF match, occurrences, map, stats, AI habitat summary, empty state.
10. Error and offline handling, `ErrorCard` everywhere, cache fallbacks.
11. Packaging both platforms, full smoke checklist, README rewrite.

Each step leaves the app runnable.

---

## 15. Open items

- The repository is not under version control. `git init` before implementation begins, so the refactor in step 3 is recoverable.
- **User action required before step 5:** create an OAuth client of type *Desktop app* in the Google Cloud console for the same project as `firebase-applet-config.json`, then copy the client ID and secret into `electron/oauth-config.json`. Step 5 is testable only after this exists; everything else proceeds without it.
- `firebase-applet-config.json` stays in use. `firestore.rules` and `firebase-blueprint.json` describe a Firestore backend this design does not deploy — all data is local to IndexedDB. Keep them if the final report discusses the Firestore design, delete them if not.
