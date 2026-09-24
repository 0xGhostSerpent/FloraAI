import { clear, get, set } from 'idb-keyval';
import type { AiProviderId } from './types/flora';

export type PlantStatus = {
  overall: 'healthy' | 'stressed' | 'declining' | 'unknown';
  hydration: string;
  leafCondition: string;
  lightAdequacy: string;
  recommendedAction: string;
  assessedAt: number;
};

export type PlantData = {
  id: string;
  name: string;
  careInstructions: string;
  healthStatus: string;
  personality: string;
  isToxic?: boolean;
  toxicityDetails?: string;
  toxicAlertLevel?: 'high' | 'low' | 'none';
  imageUrl: string;
  dateScanned: string;
  timestamp: number;
  checkIns: {
    dateId: string; // e.g. "2023-10-27"
    imageUrl: string;
  }[];
  // Added for the nursery and wild lookups. Optional so plants saved before
  // this change keep loading — that is why no migration is needed.
  scientificName?: string;
  confidence?: number;
  status?: PlantStatus;
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
  /** GBIF's full count, which exceeds records.length once past the page cap. */
  total: number;
  records: Occurrence[];
  topCountries: { country: string; count: number }[];
  nearestKm?: number;
};

export type SpeciesMatch = {
  usageKey: number;
  scientificName: string;
  rank: string;
  family?: string;
  matchConfidence: number;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
};

export async function getPlants(): Promise<PlantData[]> {
  const plants = await get<PlantData[]>('flora_plants');
  return plants || [];
}

export async function savePlants(plants: PlantData[]): Promise<void> {
  await set('flora_plants', plants);
}

export async function getChatHistory(plantId: string): Promise<ChatMessage[]> {
  const history = await get<ChatMessage[]>(`flora_chat_${plantId}`);
  return history || [];
}

export async function saveChatHistory(plantId: string, messages: ChatMessage[]): Promise<void> {
  await set(`flora_chat_${plantId}`, messages);
}

export const PRICE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function isPriceCacheFresh(estimate: PriceEstimate, now: number): boolean {
  const age = now - estimate.fetchedAt;
  // A future timestamp means a clock change; treat it as untrustworthy.
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

export type AppConfig = {
  lastCheckInDate: string | null;
  streak: number;
  theme: string;
  aiProvider?: AiProviderId;
  /**
   * Per-provider, because one shared `aiModel` meant switching provider left a
   * model ID the new provider does not offer. `aiModel` is the pre-migration
   * single value, read once and then folded into aiModels.
   */
  aiModels?: Partial<Record<AiProviderId, string>>;
  aiModel?: string;
  aiBaseUrl?: string;
};

const DEFAULT_CONFIG: AppConfig = {
  lastCheckInDate: null,
  streak: 0,
  theme: 'theme-minimalist',
};

export async function getAppConfig(): Promise<AppConfig> {
  const config = await get<AppConfig>('flora_config');
  return { ...DEFAULT_CONFIG, ...config };
}

export async function saveAppConfig(config: AppConfig): Promise<void> {
  await set('flora_config', config);
}

/** Removes every plant, conversation, cache and setting from this computer. */
export async function clearAllData(): Promise<void> {
  await clear();
}
