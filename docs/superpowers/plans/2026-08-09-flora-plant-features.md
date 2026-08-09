# Flora AI Plant Features — Implementation Plan (Plan 2 of 2)

## Context

Flora AI is a course project for DIU's Desktop & Web Programming module. The submitted proposal
promises a feature the app does not yet have — **#7 Plant Marketplace & Nursery Finder**: nearby
nurseries with estimated price, availability, and Google Maps location. The user also wants the
capture flow to branch into four choices rather than dead-ending at "Save to Garden".

Plan 1 (`docs/superpowers/plans/2026-08-09-flora-desktop-foundation.md`) delivers the Electron shell,
paywall removal, the `App.tsx` split into `src/screens/`, encrypted secrets, and PKCE loopback
sign-in. It ends with an installable app running every *existing* feature.

**This plan adds the features the proposal actually promises.** It assumes plan 1 is complete: the
`Result`/`http`/`geo` primitives, the `window.flora` bridge, and the per-screen components all exist.

Design authority: `docs/superpowers/specs/2026-08-09-flora-ai-desktop-design.md` (§4–7).

**Outcome:** capture a plant → identify it → branch into add-to-garden, plant status, where to buy
(real nearby nurseries on a map, with price and availability), or where to find it in the wild (real
GBIF sighting records).

---

## Global Constraints

Carried forward from plan 1, still binding:

- Every renderer→Node call goes through `contextBridge`. `contextIsolation: true`,
  `nodeIntegration: false`, `sandbox: true`.
- All main-process services return `Result<T>` and never throw across IPC.
- All network calls carry `AbortSignal.timeout(10_000)`.
- No `alert()`. Errors render through `ErrorCard`.

New to this plan:

- **Never fabricate stock or price data.** Availability derives from the OSM tag alone; prices are
  AI estimates and must be labelled as such on screen. This is the one part of the feature a grader
  could prove false.
- **Attribution is mandatory.** "© OpenStreetMap contributors" stays visible on every map — it is a
  condition of the tile usage policy.
- Nominatim is called only on explicit user action, keeping well inside its 1 req/sec policy.
- Theme tokens only for styling: `bg-bg-main`, `bg-bg-card`, `text-text-main`, `text-text-muted`,
  `var(--color-accent)`, `var(--radius-dynamic)`, `dynamic-border`, `dynamic-shadow`. Never hardcode
  colours — the three themes in `src/index.css` swap every one of them.

---

## File Structure

**Created — main process:**

| Path | Responsibility |
|---|---|
| `electron/services/geocode.ts` | Nominatim forward geocode, IP fallback |
| `electron/services/nurseries.ts` | Overpass query builder, response parser, distance sort |
| `electron/services/gbif.ts` | Species match, occurrence search, aggregation |
| `*.test.ts` alongside each | Vitest, pure functions only |

**Created — renderer:**

| Path | Responsibility |
|---|---|
| `src/services/ai.ts` | Every Gemini call and response schema |
| `src/hooks/useCamera.ts` | `getUserMedia` lifecycle, capture to data URL |
| `src/components/MapView.tsx` | Shared Leaflet wrapper |
| `src/screens/ScanResultScreen.tsx` | Identification + the four action cards |
| `src/screens/StatusScreen.tsx` | Structured health assessment |
| `src/screens/NurseryScreen.tsx` | Nursery list, map, price, availability |
| `src/screens/WildScreen.tsx` | GBIF map, stats, habitat summary |

**Modified:** `src/store.ts`, `src/App.tsx`, `src/screens/ScannerScreen.tsx`, `electron/main.ts`,
`electron/preload.ts`, `src/types/flora.d.ts`, `package.json`

---

## Task 1: Data model, store accessors, and the CSP font fix

**Files:** modify `src/store.ts`, `electron/main.ts`; create `src/store.test.ts`

### Step 1 — Correct the plan 1 CSP (do this first)

`src/index.css:1` imports Lora, Nunito, and Fira Code from `fonts.googleapis.com`. Plan 1's CSP
(`style-src 'self' 'unsafe-inline'`, `font-src 'self' data:`) blocks that stylesheet and its font
files. The failure is invisible in development — the CSP only applies to packaged builds — and shows
up as all three themes falling back to a system serif.

In `electron/main.ts`, widen two directives:

```ts
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
```

*Optional hardening, not required:* download the three families into `src/assets/fonts/` and replace
the `@import` with `@font-face` rules. That makes typography work with no network at all, which suits
a desktop app, but costs an afternoon. The CSP widening above is sufficient.

### Step 2 — Add the new types

Append to `src/store.ts`. Every new `PlantData` field is optional so records saved before this change
keep loading — this is why no migration is needed.

```ts
export type PlantStatus = {
  overall: 'healthy' | 'stressed' | 'declining' | 'unknown';
  hydration: string;
  leafCondition: string;
  lightAdequacy: string;
  recommendedAction: string;
  assessedAt: number;
};

export type UserLocation = {
  label: string;
  lat: number;
  lon: number;
  countryCode?: string;
  source: 'manual' | 'ip';
};

export type NurseryKind = 'garden_centre' | 'nursery' | 'plant_nursery' | 'florist';

export type Nursery = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  distanceKm: number;
  address?: string;
  phone?: string;
  website?: string;
  openingHours?: string;
  kind: NurseryKind;
  availability: 'likely' | 'call_ahead' | 'unknown';
};

export type PriceBand = { min: number; max: number };

export type PriceEstimate = {
  scientificName: string;
  currency: string;
  small: PriceBand;
  medium: PriceBand;
  large: PriceBand;
  note: string;
  fetchedAt: number;
};

export type Occurrence = {
  lat: number;
  lon: number;
  country?: string;
  countryCode?: string;
  year?: number;
  basisOfRecord: string;
};

export type OccurrenceSet = {
  total: number;
  records: Occurrence[];
  topCountries: { country: string; count: number }[];
  nearestKm?: number;
};
```

Extend `PlantData` with `scientificName?: string`, `confidence?: number`, `status?: PlantStatus`.

### Step 3 — Write the failing cache-freshness test

Create `src/store.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isPriceCacheFresh, PRICE_TTL_MS, type PriceEstimate } from './store';

const estimate = (fetchedAt: number): PriceEstimate => ({
  scientificName: 'Monstera deliciosa',
  currency: 'BDT',
  small: { min: 300, max: 600 },
  medium: { min: 700, max: 1400 },
  large: { min: 1500, max: 3000 },
  note: 'Estimate',
  fetchedAt,
});

describe('isPriceCacheFresh', () => {
  const now = 1_800_000_000_000;

  it('accepts an estimate fetched just now', () => {
    expect(isPriceCacheFresh(estimate(now), now)).toBe(true);
  });

  it('accepts an estimate one minute inside the TTL', () => {
    expect(isPriceCacheFresh(estimate(now - PRICE_TTL_MS + 60_000), now)).toBe(true);
  });

  it('rejects an estimate one minute past the TTL', () => {
    expect(isPriceCacheFresh(estimate(now - PRICE_TTL_MS - 60_000), now)).toBe(false);
  });

  it('rejects an estimate with a future timestamp as untrustworthy', () => {
    expect(isPriceCacheFresh(estimate(now + 60_000), now)).toBe(false);
  });
});
```

Run `npx vitest run src/store.test.ts` — expect FAIL, `isPriceCacheFresh` not exported.

### Step 4 — Implement the accessors

```ts
export const PRICE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function isPriceCacheFresh(estimate: PriceEstimate, now: number): boolean {
  const age = now - estimate.fetchedAt;
  return age >= 0 && age <= PRICE_TTL_MS;
}

export async function getUserLocation(): Promise<UserLocation | null> {
  return (await get<UserLocation>('flora_location')) ?? null;
}

export async function saveUserLocation(location: UserLocation): Promise<void> {
  await set('flora_location', location);
}

export async function getPriceEstimate(scientificName: string): Promise<PriceEstimate | null> {
  const cache = (await get<Record<string, PriceEstimate>>('flora_price_cache')) ?? {};
  const hit = cache[scientificName];
  return hit && isPriceCacheFresh(hit, Date.now()) ? hit : null;
}

export async function savePriceEstimate(estimate: PriceEstimate): Promise<void> {
  const cache = (await get<Record<string, PriceEstimate>>('flora_price_cache')) ?? {};
  cache[estimate.scientificName] = estimate;
  await set('flora_price_cache', cache);
}

/** Coordinates are rounded so small movements reuse the same cached search. */
export const nurseryCacheKey = (lat: number, lon: number, radiusKm: number): string =>
  `${lat.toFixed(2)},${lon.toFixed(2)},${radiusKm}`;

export async function getCachedNurseries(key: string): Promise<Nursery[] | null> {
  const cache = (await get<Record<string, Nursery[]>>('flora_nursery_cache')) ?? {};
  return cache[key] ?? null;
}

export async function saveCachedNurseries(key: string, list: Nursery[]): Promise<void> {
  const cache = (await get<Record<string, Nursery[]>>('flora_nursery_cache')) ?? {};
  cache[key] = list;
  await set('flora_nursery_cache', cache);
}
```

Run the test — expect PASS, 4 tests. Commit: `feat: add nursery, price, and location types to the store`.

---

## Task 2: Geocoding service

**Files:** create `electron/services/geocode.ts`, `electron/services/geocode.test.ts`; modify
`electron/main.ts`, `electron/preload.ts`, `src/types/flora.d.ts`

**Produces:** `geocodeQuery(query: string): Promise<Result<UserLocation>>`,
`locateByIp(): Promise<Result<UserLocation>>`; bridge members `window.flora.geocode(query)` and
`window.flora.locateByIp()`.

Write tests first, stubbing `fetch` exactly as `http.test.ts` does in plan 1:

- a Nominatim array response maps to `{ label, lat, lon, countryCode, source: 'manual' }`, with `lat`
  and `lon` converted from Nominatim's **strings** to numbers
- an empty Nominatim array returns `err('GEOCODE_NONE', ...)` — the API returns `[]` rather than a
  404 for an unmatched place, so this is the miss path
- the request URL carries `format=json`, `limit=1`, and `addressdetails=1`
- an ipapi.co response maps to `source: 'ip'`
- ipapi.co's error shape (`{ "error": true, "reason": "..." }`) returns a failed `Result`, since it
  arrives with HTTP 200 and would otherwise parse as a success

Implementation calls `getJson` from plan 1's `http.ts`, which already sets the `User-Agent` Nominatim
requires and the 10-second timeout.

```ts
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const IPAPI = 'https://ipapi.co/json/';

type NominatimHit = {
  lat: string;
  lon: string;
  display_name: string;
  address?: { country_code?: string };
};

export async function geocodeQuery(query: string): Promise<Result<UserLocation>> {
  const url = `${NOMINATIM}?${new URLSearchParams({
    q: query, format: 'json', limit: '1', addressdetails: '1',
  })}`;

  const response = await getJson<NominatimHit[]>(url);
  if (!response.ok) return response;

  const [hit] = response.data;
  if (!hit) return err('GEOCODE_NONE', "Couldn't find that place. Try a city name.");

  return ok({
    label: hit.display_name,
    lat: Number(hit.lat),
    lon: Number(hit.lon),
    countryCode: hit.address?.country_code?.toUpperCase(),
    source: 'manual',
  });
}
```

`locateByIp` follows the same shape against `IPAPI`, mapping `latitude`/`longitude`/`city`/
`country_code` and rejecting the `error: true` body.

Register `flora:geocode` and `flora:locateByIp` IPC handlers, expose both on the bridge, add both to
`FloraApi`. Commit: `feat: add Nominatim geocoding with IP fallback`.

---

## Task 3: Nursery service

**Files:** create `electron/services/nurseries.ts`, `electron/services/nurseries.test.ts`; modify
`electron/main.ts`, `electron/preload.ts`, `src/types/flora.d.ts`

**Produces:** `buildOverpassQuery(lat, lon, radiusMeters): string`,
`parseOverpass(body: OverpassResponse, origin: Coord): Nursery[]`,
`findNurseries(opts: { lat, lon, radiusKm }): Promise<Result<Nursery[]>>`; bridge member
`window.flora.findNurseries(opts)`.

This is the highest-value task to test, because Overpass returns three element shapes and only one of
them carries coordinates directly.

### Tests

```ts
const body = {
  elements: [
    { type: 'node', id: 1, lat: 23.81, lon: 90.41, tags: { shop: 'garden_centre', name: 'Green Thumb' } },
    { type: 'way', id: 2, center: { lat: 23.82, lon: 90.42 }, tags: { shop: 'florist', name: 'Petal Co' } },
    { type: 'node', id: 3, lat: 23.83, lon: 90.43, tags: { shop: 'florist' } },          // no name
    { type: 'node', id: 4, tags: { shop: 'nursery', name: 'No Coords' } },                // no coords
    { type: 'way', id: 5, center: { lat: 23.9, lon: 90.5 }, tags: { landuse: 'plant_nursery', name: 'Far Farm' } },
  ],
};
```

Assert that `parseOverpass(body, { lat: 23.8103, lon: 90.4125 })`:

1. **reads `center` for ways** — "Petal Co" appears with the coordinates from `center`, since ways
   carry no `lat`/`lon` of their own
2. **drops unnamed elements** — id 3 is absent
3. **drops elements with no usable coordinates** — id 4 is absent
4. **sorts nearest first** — "Green Thumb" precedes "Far Farm"
5. **builds stable ids** — `'node/1'`, `'way/2'`
6. **maps `landuse=plant_nursery`** to `kind: 'plant_nursery'`

Availability mapping gets its own test per branch: `garden_centre`/`nursery`/`plant_nursery` →
`'likely'`, `florist` → `'call_ahead'`, anything else → `'unknown'`.

`buildOverpassQuery` gets a snapshot test asserting the string contains `out center tags` — without
`out center`, ways come back with no coordinates and half the results vanish silently.

Tag-variant test: `contact:phone` and `contact:website` are used as fallbacks when plain `phone` and
`website` are absent.

### Implementation

```ts
const ENDPOINT = 'https://overpass-api.de/api/interpreter';
const SHOP_TAGS = 'garden_centre|florist|nursery';

export function buildOverpassQuery(lat: number, lon: number, radiusMeters: number): string {
  const around = `(around:${radiusMeters},${lat},${lon})`;
  return `[out:json][timeout:25];
(
  node["shop"~"${SHOP_TAGS}"]${around};
  way["shop"~"${SHOP_TAGS}"]${around};
  node["landuse"="plant_nursery"]${around};
  way["landuse"="plant_nursery"]${around};
);
out center tags;`;
}

const availabilityFor = (kind: NurseryKind): Nursery['availability'] =>
  kind === 'florist' ? 'call_ahead' : 'likely';

function addressFrom(tags: Record<string, string>): string | undefined {
  const parts = [tags['addr:housenumber'], tags['addr:street'], tags['addr:city'], tags['addr:postcode']];
  const joined = parts.filter(Boolean).join(' ').trim();
  return joined || undefined;
}
```

`parseOverpass` resolves coordinates as `element.lat ?? element.center?.lat`, skips anything missing
coordinates or `tags.name`, derives `kind` from `tags.shop ?? (tags.landuse === 'plant_nursery' ? 'plant_nursery' : undefined)`,
computes `distanceKm` with plan 1's `haversineKm`, and sorts ascending.

`findNurseries` POSTs the query as form data to `ENDPOINT`, maps HTTP 429 to
`err('OVERPASS_BUSY', 'Nursery service is busy. Try again in a moment.')` and the timeout code to
`err('OVERPASS_TIMEOUT', 'Search took too long. Try a smaller radius.')`, then returns
`parseOverpass(...)`. An empty result array is a successful `Result` with `[]` — the screen, not the
service, decides how to phrase "nothing nearby".

Commit: `feat: add Overpass nursery search with parsing tests`.

---

## Task 4: GBIF service

**Files:** create `electron/services/gbif.ts`, `electron/services/gbif.test.ts`; modify
`electron/main.ts`, `electron/preload.ts`, `src/types/flora.d.ts`

**Produces:** `matchSpecies(scientificName): Promise<Result<SpeciesMatch>>`,
`parseOccurrences(body, origin?): OccurrenceSet`,
`findOccurrences(taxonKey: number, origin?: Coord): Promise<Result<OccurrenceSet>>`; bridge members
`window.flora.gbifMatch(name)` and `window.flora.gbifOccurrences(taxonKey, origin)`.

### Tests for `parseOccurrences`

The filtering rule is the substance here. `LIVING_SPECIMEN` records are botanical-garden accessions —
the opposite of "found in the wild" — so they must be excluded, and a test has to pin that down or
the distinction will quietly erode.

- keeps `HUMAN_OBSERVATION`, `OBSERVATION`, `MACHINE_OBSERVATION`
- drops `LIVING_SPECIMEN` and `PRESERVED_SPECIMEN`
- drops records where `decimalLatitude` or `decimalLongitude` is null
- `total` reflects GBIF's `count` field, **not** `records.length` — the API caps a page at 300 while
  `count` may be in the thousands
- `topCountries` aggregates and sorts descending, ties broken alphabetically for determinism
- `nearestKm` is the smallest `haversineKm` to the supplied origin; `undefined` when no origin is given
- an empty `results` array yields `{ total: 0, records: [], topCountries: [] }` rather than throwing

### Tests for `matchSpecies`

- a body with `matchType: 'NONE'` returns `err('SPECIES_NO_MATCH', ...)` — GBIF signals a miss with
  HTTP 200 and this field, so it would otherwise read as success
- a successful match maps `usageKey`, `scientificName`, `rank`, `family`, `confidence`

### Implementation notes

```ts
const WILD_BASIS = new Set(['HUMAN_OBSERVATION', 'OBSERVATION', 'MACHINE_OBSERVATION']);

const MATCH_ENDPOINT = 'https://api.gbif.org/v1/species/match';
const OCCURRENCE_ENDPOINT = 'https://api.gbif.org/v1/occurrence/search';
```

`findOccurrences` requests `taxonKey`, `hasCoordinate=true`, `hasGeospatialIssue=false`, `limit=300`.

Commit: `feat: add GBIF species match and wild occurrence search`.

---

## Task 5: AI service module

**Files:** create `src/services/ai.ts`; modify `src/App.tsx`

Extract every Gemini call out of `App.tsx` (currently inline at lines 196-254 and 344-364) into one
module, then add the three new calls. Each returns a `Result`-shaped value so screens handle failure
uniformly.

**Exports:** `identifyPlant(image, apiKey)`, `checkInOnPlant(image, plant, apiKey)`,
`assessStatus(image, plant, apiKey)`, `estimatePrice(scientificName, countryName, apiKey)`,
`describeHabitat(scientificName, apiKey)`, `chat(plant, history, apiKey)`.

**The one change with downstream consequences:** `identifyPlant`'s `responseSchema` gains
`scientificName: { type: Type.STRING }` and `confidence: { type: Type.NUMBER }`, both added to
`required`. GBIF matching (Task 4) and price estimation are useless without a binomial name, so this
field is load-bearing for two of the four actions.

New schemas:

```ts
// assessStatus
{ overall: STRING, hydration: STRING, leafCondition: STRING,
  lightAdequacy: STRING, recommendedAction: STRING }

// estimatePrice — prompt supplies the country so the currency is local
{ currency: STRING, small: { min: NUMBER, max: NUMBER },
  medium: { min: NUMBER, max: NUMBER }, large: { min: NUMBER, max: NUMBER }, note: STRING }

// describeHabitat
{ nativeRange: STRING, habitat: STRING, season: STRING, whatToLookFor: STRING }
```

`estimatePrice` returns a typical retail range for a potted specimen in the named country, in that
country's currency as an ISO 4217 code. The prompt must instruct the model to give a *range*, never a
single figure — a range reads as the estimate it is.

Verify by scanning a plant and confirming `scientificName` appears in the response. Commit:
`feat: extract Gemini calls into a service module with new schemas`.

---

## Task 6: Webcam capture

**Files:** create `src/hooks/useCamera.ts`; modify `src/screens/ScannerScreen.tsx`, `src/App.tsx`

`<input type="file" capture="environment">` is a plain file picker on desktop — the `capture`
attribute does nothing. Real capture needs `getUserMedia`.

```ts
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<'idle' | 'starting' | 'live' | 'denied' | 'unavailable'>('idle');

  const start = useCallback(async () => { /* getUserMedia({ video: true }), attach to videoRef */ }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setState('idle');
  }, []);

  const capture = useCallback((): string | null => {
    /* draw videoRef into a canvas at video dimensions, return canvas.toDataURL('image/jpeg', 0.9) */
  }, []);

  useEffect(() => stop, [stop]);   // stopping on unmount is not optional

  return { videoRef, state, start, stop, capture };
}
```

**Every track must be stopped** on unmount, on navigating away, and immediately after capture. Skip
this and the camera light stays on after the user leaves the screen — the most common and most
alarming Electron camera bug.

`ScannerScreen` gains a source toggle: **Use camera** (live preview + shutter) and **Upload image**
(the existing file input, with `capture` removed). Both produce a data URL and land on the same
preview, so everything downstream is unchanged.

Handle `state === 'denied'` and `'unavailable'` with an `ErrorCard` offering the upload path — many
Linux machines have no webcam at all, and that must not be a dead end.

Commit: `feat: add live webcam capture alongside file upload`.

---

## Task 7: Scan result screen and the four actions

**Files:** create `src/screens/ScanResultScreen.tsx`, `src/screens/StatusScreen.tsx`; modify
`src/App.tsx`, `src/screens/ScannerScreen.tsx`

Split today's combined scanner: `ScannerScreen` ends at capture and analysis; `ScanResultScreen` owns
the identification and what follows.

Preserve the existing toxicity interstitial — `isToxic` still gates the red alert before any result
is shown (currently `App.tsx:566-579`). It must appear *before* the action cards.

The four cards, in order:

| Card | Behaviour |
|---|---|
| **Add to Garden** | Existing `savePlantData` path — persists, updates streak, returns Home |
| **Plant Status** | Calls `assessStatus`, pushes `StatusScreen` |
| **Where to Buy** | Pushes `NurseryScreen` with `scientificName` and `name` |
| **Find in the Wild** | Pushes `WildScreen` with `scientificName` |

Cards 3 and 4 must work **without** the plant being saved — that is the point of offering them at
capture time. Add `'scanResult'`, `'status'`, `'nurseries'`, `'wild'` to the `currentScreen` union,
and give `App.tsx` an `activeSpecies: { name: string; scientificName?: string } | null` state so the
nursery and wild screens know their subject whether it came from a fresh scan or a saved plant.

Wire the same four actions into the saved-plant view so a garden plant reaches them too.

`StatusScreen` renders the five `PlantStatus` fields as labelled rows with `recommendedAction`
emphasised, and an `overall` badge coloured from the theme accent. When the plant is in the garden,
persist `status` onto the record.

Commit: `feat: add scan result screen with four post-capture actions`.

---

## Task 8: Shared map component

**Files:** create `src/components/MapView.tsx`; modify `package.json`

```bash
npm install leaflet@^1.9.4 && npm install --save-dev @types/leaflet@^1.9.12
```

**Use `L.circleMarker`, not `L.marker`.** Leaflet's default marker resolves icon PNGs by URL, which
breaks under bundlers and again under the packaged CSP; `circleMarker` is pure SVG and sidesteps both.
This avoids the `L.Icon.Default.mergeOptions` workaround entirely.

```tsx
type Props = {
  points: { lat: number; lon: number; label?: string; accent?: boolean }[];
  center?: { lat: number; lon: number };
  zoom?: number;
  className?: string;
};
```

Requirements: `import 'leaflet/dist/leaflet.css'`; fit bounds to points when two or more exist, else
centre on the single point; destroy the map instance on unmount (Leaflet leaks otherwise, and React
19 strict mode will double-invoke the effect); keep the
`attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'`
option on the tile layer — it is a usage-policy condition, not decoration.

The tile host is already allowed by plan 1's `img-src`. Verify a map renders in the **packaged**
build, not just development, since that is where the CSP applies.

Commit: `feat: add shared Leaflet map component`.

---

## Task 9: Nursery screen

**Files:** create `src/screens/NurseryScreen.tsx`; modify `src/App.tsx`

The proposal's headline feature. Flow:

1. **No stored location** → prompt for a city or postcode, with a "Use my approximate location"
   button calling `locateByIp`. Persist the result via `saveUserLocation`.
2. **Location known** → call `findNurseries({ lat, lon, radiusKm })`, default 15 km, with a radius
   selector offering 5 / 15 / 30 / 50 km.
3. Render `MapView` with every result plus the user's own position (`accent: true`), then the list.

Each card shows name, distance to one decimal, address, opening hours, an availability badge, and:

- **"Open in Google Maps"** → `window.flora.openExternal('https://www.google.com/maps/search/?api=1&query=<lat>,<lon>')`.
  This is what satisfies the proposal's Google Maps requirement — no key, no billing.
- **Phone and website** where OSM supplies them, both via `openExternal`.

Above the list, one price panel for the species: check `getPriceEstimate(scientificName)` first, call
`estimatePrice` only on a miss, then `savePriceEstimate`. Three size bands, with the caption
**"AI estimate — not a quote from any seller"** always visible.

The availability badge renders from `nursery.availability` with the fixed line
**"Availability not verified — call to confirm"** beneath the list. Both captions are requirements,
not copy suggestions: they are what keep the feature honest about data the sources do not provide.

Empty result → "No nurseries found within {radius} km. Try widening the search," with the radius
selector still in reach. Error → `ErrorCard` with retry.

Reachable from the bottom nav (added in plan 1 Task 2) and from the Where to Buy action card. From
the nav with no species selected, show the nursery list and hide the price panel.

Commit: `feat: add nursery finder with map, price estimate, and availability`.

---

## Task 10: Wild occurrence screen

**Files:** create `src/screens/WildScreen.tsx`; modify `src/App.tsx`

Chain `gbifMatch(scientificName)` → `gbifOccurrences(usageKey, userLocation)`.

Renders: `MapView` of sightings, `total` count, top countries, `nearestKm` when a location is stored,
and the `describeHabitat` summary — native range, habitat, season, what to look for.

**The empty state is the case that will actually occur most.** Cultivated houseplants routinely have
zero wild records, and both `SPECIES_NO_MATCH` and a zero-record result must render:

> "No verified wild records in GBIF — this species is primarily cultivated."

alongside the AI native-range text. Never a blank map. Test this deliberately with a houseplant
(*Monstera deliciosa* or *Sansevieria trifasciata*), not just a wildflower.

Attribute the data to GBIF in the footer.

Commit: `feat: add wild occurrence screen backed by GBIF`.

---

## Task 11: Offline caching and final verification

**Files:** modify `src/screens/NurseryScreen.tsx`, `electron/services/*`, `README.md`

1. On a successful nursery search, `saveCachedNurseries(nurseryCacheKey(...), list)`. On
   `NETWORK`/`TIMEOUT`, fall back to the cached list with a visible "Showing last saved results" note.
2. Audit every screen added in this plan for the error codes in spec §10 — `OVERPASS_BUSY`,
   `OVERPASS_TIMEOUT`, `NO_RESULTS`, `GEOCODE_NONE`, `SPECIES_NO_MATCH`, `NO_API_KEY`, `OFFLINE` —
   each with the message the spec specifies.
3. Confirm `grep -rn "alert(" src/` returns nothing.
4. Document the new features and their data sources in `README.md`, crediting OpenStreetMap, Nominatim,
   Overpass, and GBIF.

Commit: `feat: add offline nursery cache and complete error handling`.

---

## Verification

**Automated** — `npm test` and `npm run lint`. Expect roughly 45 tests across 8 files: plan 1's 19,
plus store cache freshness (4), geocode (5), Overpass parsing (9), and GBIF (8).

**Manual, in the packaged AppImage rather than development** — the CSP, `file://` loading, and tile
fetching only behave differently there:

1. Capture via webcam; confirm the camera light goes out when you leave the screen.
2. Capture via file upload on a machine with no webcam; confirm the error offers the upload path.
3. Scan a plant → all four action cards appear; the toxicity alert still precedes them for a toxic
   species.
4. Add to Garden → plant persists across a restart.
5. Plant Status → five populated fields.
6. Where to Buy → enter a city, get real nurseries, map renders with attribution visible, price panel
   shows a range and its caption, availability badges match the OSM tag, Google Maps link opens the
   system browser at the right pin.
7. Repeat the search → price comes from cache with no second Gemini call.
8. Find in the Wild → a wildflower shows real sightings; a houseplant shows the cultivated empty
   state, never a blank map.
9. Disconnect the network, repeat the nursery search → cached results with the "last saved" note.
10. Both actions reachable from a saved garden plant, not only a fresh scan.
11. All three themes still apply, **fonts included** — this is the check that the Task 1 CSP fix
    actually landed.

**Definition of done:** the proposal's Feature #7 demonstrably works against real data, the four
post-capture actions all function, and nothing in the app claims a fact its data source cannot support.
