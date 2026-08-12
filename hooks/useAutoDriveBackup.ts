import { useEffect, useRef } from 'react';
import { useDriveStore } from '@/src/store/driveStore';
import { useWatchlistStore } from '@/src/store/watchlistStore';

const DEBOUNCE_MS = 8000;

/** Po změně watchlistu automaticky zálohuje na Google Drive (debounce 8 s). */
export function useAutoDriveBackup(enabled: boolean) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = useWatchlistStore.subscribe((state, prev) => {
      if (state.items === prev.items) return;

      const { connected, autoBackup, backupNow } = useDriveStore.getState();
      if (!connected || !autoBackup) return;

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        backupNow().catch(() => undefined);
      }, DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled]);
}
