import { contextBridge, ipcRenderer } from 'electron';

const invoke = <T>(channel: string, payload?: unknown): Promise<T> =>
  ipcRenderer.invoke(channel, payload) as Promise<T>;

contextBridge.exposeInMainWorld('flora', {
  openExternal: (url: string) => invoke<void>('flora:openExternal', url),
  secrets: {
    get: (name: string) => invoke<string | null>('flora:secrets:get', name),
    set: (name: string, value: string) => invoke<boolean>('flora:secrets:set', { name, value }),
    clear: (name: string) => invoke<void>('flora:secrets:clear', name),
    backend: () => invoke<'os' | 'basic'>('flora:secrets:backend'),
  },
  auth: {
    signIn: () => invoke<unknown>('flora:auth:signIn'),
    isConfigured: () => invoke<boolean>('flora:auth:isConfigured'),
    clearTokens: () => invoke<void>('flora:auth:clearTokens'),
  },
  drive: {
    syncBackup: (payload: unknown) => invoke<unknown>('flora:drive:syncBackup', payload),
    getLastSync: () => invoke<{ syncedAt: number | null }>('flora:drive:getLastSync'),
  },
  ai: {
    complete: (req: unknown) => invoke<unknown>('flora:ai:complete', req),
    listModels: (target: unknown) => invoke<unknown>('flora:ai:listModels', target),
  },
  net: {
    status: () => invoke<boolean>('flora:net:status'),
    // Returns its own unsubscribe so the renderer never leaks a listener.
    onChange: (handler: (online: boolean) => void) => {
      const listener = (_event: unknown, online: boolean) => handler(online);
      ipcRenderer.on('flora:net:changed', listener);
      return () => ipcRenderer.removeListener('flora:net:changed', listener);
    },
  },
  geocode: (query: string) => invoke<unknown>('flora:geocode', query),
  locateByIp: () => invoke<unknown>('flora:locateByIp'),
  findNurseries: (opts: { lat: number; lon: number; radiusKm: number }) =>
    invoke<unknown>('flora:findNurseries', opts),
  gbifMatch: (name: string) => invoke<unknown>('flora:gbifMatch', name),
  gbifOccurrences: (taxonKey: number, origin?: { lat: number; lon: number }) =>
    invoke<unknown>('flora:gbifOccurrences', { taxonKey, origin }),
});
