import { BrowserWindow, net } from 'electron';

/**
 * A cheap, cacheable liveness target. Chosen because it answers 204 with an
 * empty body and is not the AI provider — so a provider outage never reads as
 * "you are offline".
 */
const PROBE_URL = 'https://www.gstatic.com/generate_204';
const PROBE_TIMEOUT_MS = 4_000;
const CACHE_MS = 5_000;
const POLL_MS = 20_000;

let cached: { online: boolean; at: number } | null = null;
let lastBroadcast: boolean | null = null;
let timer: NodeJS.Timeout | null = null;

/**
 * Electron's net module is absent when this code is imported outside the
 * Electron runtime (unit tests), so its verdict is treated as optional rather
 * than forcing every consumer's test to mock electron.
 */
const linkIsUp = (): boolean => {
  try {
    return net?.isOnline?.() ?? true;
  } catch {
    return true;
  }
};

async function probe(): Promise<boolean> {
  // The OS link state is cheap and decisive when false, but reads "online" for
  // a connected machine behind a dead gateway or captive portal.
  if (!linkIsUp()) return false;

  try {
    const response = await fetch(PROBE_URL, {
      method: 'HEAD',
      cache: 'no-store',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return response.ok || response.status === 204;
  } catch {
    return false;
  }
}

/** Cached so a burst of failing requests does not trigger a probe each time. */
export async function isOnline(): Promise<boolean> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.online;
  const online = await probe();
  cached = { online, at: Date.now() };
  return online;
}

/** Discards the cached verdict so the next check probes for real. */
export function clearOnlineCache(): void {
  cached = null;
}

function broadcast(online: boolean): void {
  if (online === lastBroadcast) return;
  lastBroadcast = online;
  for (const win of BrowserWindow?.getAllWindows?.() ?? []) {
    if (!win.isDestroyed()) win.webContents.send('flora:net:changed', online);
  }
}

/** Polls in the background so the UI reflects reality without being asked. */
export function startNetworkWatch(): void {
  if (timer) return;
  const tick = async () => {
    clearOnlineCache(); // Probe for real rather than reading our own cache.
    broadcast(await isOnline());
  };
  void tick();
  timer = setInterval(() => void tick(), POLL_MS);
}

export function stopNetworkWatch(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

/** Lets a failed request re-probe immediately instead of waiting for the poll. */
export async function refreshOnlineStatus(): Promise<boolean> {
  clearOnlineCache();
  const online = await isOnline();
  broadcast(online);
  return online;
}
