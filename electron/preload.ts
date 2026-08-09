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
});
