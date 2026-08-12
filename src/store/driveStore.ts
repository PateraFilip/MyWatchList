import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  clearGoogleTokens,
  fetchGoogleEmail,
  loadGoogleTokens,
  saveGoogleTokens,
} from '@/src/services/googleAuth';
import {
  snapshotItemCount,
  tryDownloadBackupFromDrive,
  uploadBackupToDrive,
} from '@/src/services/googleDrive';
import { useWatchlistStore } from '@/src/store/watchlistStore';

export type ConnectSyncResult =
  | { action: 'restored'; localCount: number; remoteCount: number }
  | { action: 'uploaded'; localCount: number; remoteCount: number }
  | { action: 'noop'; localCount: number; remoteCount: number }
  | { action: 'needs_choice'; localCount: number; remoteCount: number };

interface DriveState {
  connected: boolean;
  email: string | null;
  autoBackup: boolean;
  lastBackupAt: string | null;
  lastError: string | null;
  syncing: boolean;
  hydrated: boolean;

  setHydrated: (value: boolean) => void;
  setAutoBackup: (value: boolean) => void;
  connectWithTokens: (tokens: {
    accessToken: string;
    refreshToken?: string | null;
    expiresIn?: number | null;
    email?: string | null;
  }) => Promise<void>;
  disconnect: () => Promise<void>;
  restoreSession: () => Promise<void>;
  /** Po připojení: obnoví z Drive / nahraje / nebo požádá o volbu */
  syncAfterConnect: () => Promise<ConnectSyncResult>;
  backupNow: (options?: { force?: boolean }) => Promise<void>;
  restoreFromDrive: () => Promise<number>;
}

function localSnapshot() {
  return useWatchlistStore.getState().getBackupSnapshot();
}

export const useDriveStore = create<DriveState>()(
  persist(
    (set, get) => ({
      connected: false,
      email: null,
      autoBackup: true,
      lastBackupAt: null,
      lastError: null,
      syncing: false,
      hydrated: false,

      setHydrated: (value) => set({ hydrated: value }),

      setAutoBackup: (value) => set({ autoBackup: value }),

      connectWithTokens: async (tokens) => {
        const email =
          tokens.email || (await fetchGoogleEmail(tokens.accessToken));
        await saveGoogleTokens({ ...tokens, email });
        set({
          connected: true,
          email,
          lastError: null,
        });
      },

      disconnect: async () => {
        try {
          const { signOutGoogleNative } = await import('@/src/services/googleSignIn');
          await signOutGoogleNative();
        } catch {
          // ignore
        }
        await clearGoogleTokens();
        set({
          connected: false,
          email: null,
          lastError: null,
          lastBackupAt: null,
        });
      },

      restoreSession: async () => {
        const tokens = await loadGoogleTokens();
        if (!tokens) {
          set({ connected: false, email: null });
          return;
        }
        set({ connected: true, email: tokens.email });
      },

      syncAfterConnect: async () => {
        const local = localSnapshot();
        const localCount = snapshotItemCount(local);
        const remote = await tryDownloadBackupFromDrive();
        const remoteCount = remote ? snapshotItemCount(remote) : 0;

        // Prázdný telefon + plná záloha na Drive → automaticky obnov
        if (localCount === 0 && remoteCount > 0 && remote) {
          useWatchlistStore.getState().restoreFromBackup({
            items: remote.items,
            notifications: remote.notifications,
            lastNotificationCheck: remote.lastNotificationCheck,
          });
          set({ lastBackupAt: remote.exportedAt, lastError: null });
          return { action: 'restored', localCount, remoteCount };
        }

        // Na Drive nic není → nahraj lokální (pokud něco je)
        if (!remote) {
          if (localCount > 0) {
            await get().backupNow({ force: true });
            return { action: 'uploaded', localCount, remoteCount: 0 };
          }
          return { action: 'noop', localCount, remoteCount: 0 };
        }

        // Lokální má méně položek než Drive → nechat uživatele rozhodnout
        if (localCount > 0 && remoteCount > localCount) {
          return { action: 'needs_choice', localCount, remoteCount };
        }

        // Lokální je stejně velké nebo větší → bezpečně zálohovat
        if (localCount > 0) {
          await get().backupNow({ force: true });
          return { action: 'uploaded', localCount, remoteCount };
        }

        return { action: 'noop', localCount, remoteCount };
      },

      backupNow: async (options) => {
        if (get().syncing) return;
        set({ syncing: true, lastError: null });
        try {
          const snapshot = localSnapshot();
          const localCount = snapshotItemCount(snapshot);

          if (!options?.force) {
            const remote = await tryDownloadBackupFromDrive();
            const remoteCount = remote ? snapshotItemCount(remote) : 0;
            if (remote && localCount === 0 && remoteCount > 0) {
              throw new Error(
                `Lokální seznam je prázdný, na Drive je záloha s ${remoteCount} položkami. ` +
                  'Nejdřív obnov z Drive — jinak bys přepsal plnou zálohu.'
              );
            }
            if (remote && localCount > 0 && remoteCount > localCount) {
              throw new Error(
                `Na Drive je víc položek (${remoteCount}) než v telefonu (${localCount}). ` +
                  'Nejdřív obnov z Drive, nebo v Nastavení potvrď vynucenou zálohu.'
              );
            }
          }

          const result = await uploadBackupToDrive(snapshot);
          set({
            lastBackupAt: result.exportedAt,
            syncing: false,
            lastError: null,
            connected: true,
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Záloha na Drive selhala';
          set({ syncing: false, lastError: message });
          throw e;
        }
      },

      restoreFromDrive: async () => {
        set({ syncing: true, lastError: null });
        try {
          const backup = await tryDownloadBackupFromDrive();
          if (!backup) {
            throw new Error('Na Google Drive zatím žádná záloha WatchList není.');
          }
          useWatchlistStore.getState().restoreFromBackup({
            items: backup.items,
            notifications: backup.notifications,
            lastNotificationCheck: backup.lastNotificationCheck,
          });
          set({
            syncing: false,
            lastBackupAt: backup.exportedAt,
            lastError: null,
          });
          return Object.keys(backup.items).length;
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Obnova z Drive selhala';
          set({ syncing: false, lastError: message });
          throw e;
        }
      },
    }),
    {
      name: 'watchlist-drive-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        connected: state.connected,
        email: state.email,
        autoBackup: state.autoBackup,
        lastBackupAt: state.lastBackupAt,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);
