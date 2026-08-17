import { useEffect, useState } from 'react';

/**
 * Connectivity as the app should report it.
 *
 * navigator.onLine answers instantly but only knows whether an interface is up,
 * so it reads "online" behind a dead gateway or captive portal. The main process
 * probes an actual endpoint and is treated as the authority; the window events
 * exist to make the UI react the moment a cable is pulled.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const online = await window.flora.net.status();
      if (!cancelled) setIsOnline(online);
    };

    // A local "offline" is trustworthy on its own; a local "online" needs the
    // probe to confirm, so re-check instead of believing it.
    const onOffline = () => setIsOnline(false);
    const onOnline = () => void check();

    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    const unsubscribe = window.flora.net.onChange((online) => {
      if (!cancelled) setIsOnline(online);
    });

    void check();

    return () => {
      cancelled = true;
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      unsubscribe();
    };
  }, []);

  return isOnline;
}
