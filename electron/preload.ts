import { contextBridge, ipcRenderer } from 'electron';

const invoke = <T>(channel: string, payload?: unknown): Promise<T> =>
  ipcRenderer.invoke(channel, payload) as Promise<T>;

contextBridge.exposeInMainWorld('flora', {
  openExternal: (url: string) => invoke<void>('flora:openExternal', url),
  secrets: {
    get: (name: string) => invoke<string | null>('flora:secrets:get', name),
    set: (name: string, value: string) => invoke<boolean>('flora:secrets:set', { name, value }),
    clear: (name: string) => invoke<void>('flora:secrets:clear', name),
  },
  auth: {
    signIn: () => invoke<unknown>('flora:auth:signIn'),
    isConfigured: () => invoke<boolean>('flora:auth:isConfigured'),
  },
  geocode: (query: string) => invoke<unknown>('flora:geocode', query),
  locateByIp: () => invoke<unknown>('flora:locateByIp'),
  findNurseries: (opts: { lat: number; lon: number; radiusKm: number }) =>
    invoke<unknown>('flora:findNurseries', opts),
  gbifMatch: (name: string) => invoke<unknown>('flora:gbifMatch', name),
  gbifOccurrences: (taxonKey: number, origin?: { lat: number; lon: number }) =>
    invoke<unknown>('flora:gbifOccurrences', { taxonKey, origin }),
});
