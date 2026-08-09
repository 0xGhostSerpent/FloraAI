import { contextBridge, ipcRenderer } from 'electron';

const invoke = <T>(channel: string, payload?: unknown): Promise<T> =>
  ipcRenderer.invoke(channel, payload) as Promise<T>;

contextBridge.exposeInMainWorld('flora', {
  openExternal: (url: string) => invoke<void>('flora:openExternal', url),
});
