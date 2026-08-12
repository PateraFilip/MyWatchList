import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { AppNotification, WatchItem } from '@/src/types';

export const BACKUP_VERSION = 1;

export interface WatchlistBackup {
  app: 'WatchList';
  version: number;
  exportedAt: string;
  items: Record<string, WatchItem>;
  notifications: AppNotification[];
  lastNotificationCheck: string | null;
}

export function createBackupPayload(data: {
  items: Record<string, WatchItem>;
  notifications: AppNotification[];
  lastNotificationCheck: string | null;
}): WatchlistBackup {
  return {
    app: 'WatchList',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    items: data.items,
    notifications: data.notifications,
    lastNotificationCheck: data.lastNotificationCheck,
  };
}

export function parseBackup(raw: string): WatchlistBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Soubor není platný JSON.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Neplatný formát zálohy.');
  }

  const data = parsed as Partial<WatchlistBackup>;

  // Podpora i přímého dump z AsyncStorage (bez obálky)
  if (!data.app && data.items && typeof data.items === 'object') {
    return {
      app: 'WatchList',
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      items: data.items as Record<string, WatchItem>,
      notifications: Array.isArray(data.notifications) ? data.notifications : [],
      lastNotificationCheck: data.lastNotificationCheck ?? null,
    };
  }

  if (data.app !== 'WatchList' || !data.items || typeof data.items !== 'object') {
    throw new Error('Tento soubor nevypadá jako záloha WatchList.');
  }

  return {
    app: 'WatchList',
    version: typeof data.version === 'number' ? data.version : BACKUP_VERSION,
    exportedAt: data.exportedAt || new Date().toISOString(),
    items: data.items,
    notifications: Array.isArray(data.notifications) ? data.notifications : [],
    lastNotificationCheck: data.lastNotificationCheck ?? null,
  };
}

function backupFilename(): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `watchlist-backup-${stamp}.json`;
}

export async function shareBackupFile(backup: WatchlistBackup): Promise<void> {
  const json = JSON.stringify(backup, null, 2);
  const filename = backupFilename();

  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    return;
  }

  const file = new File(Paths.cache, filename);
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(json);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sdílení souborů na tomto zařízení není dostupná.');
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Uložit zálohu WatchList',
    UTI: 'public.json',
  });
}

export async function pickBackupFile(): Promise<WatchlistBackup | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.[0]) {
    return null;
  }

  const asset = result.assets[0];
  let raw: string;

  if (Platform.OS === 'web' && asset.file) {
    raw = await asset.file.text();
  } else {
    const file = new File(asset.uri);
    raw = await file.text();
  }

  return parseBackup(raw);
}

export function backupStats(backup: WatchlistBackup) {
  const items = Object.values(backup.items);
  return {
    total: items.length,
    watchlist: items.filter((i) => i.status === 'watchlist').length,
    watched: items.filter((i) => i.status === 'watched').length,
  };
}
