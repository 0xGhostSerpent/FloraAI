export type FloraApi = {
  openExternal(url: string): Promise<void>;
};

declare global {
  interface Window {
    flora: FloraApi;
  }
}

export {};
