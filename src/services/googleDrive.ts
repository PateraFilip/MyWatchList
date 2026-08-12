import {
  clearDriveFileId,
  getDriveFileId,
  refreshAccessTokenIfNeeded,
  setDriveFileId,
} from '@/src/services/googleAuth';
import {
  createBackupPayload,
  parseBackup,
  type WatchlistBackup,
} from '@/src/utils/backup';
import type { AppNotification, WatchItem } from '@/src/types';

const BACKUP_NAME = 'WatchList-backup.json';
const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

export type WatchlistSnapshot = {
  items: Record<string, WatchItem>;
  notifications: AppNotification[];
  lastNotificationCheck: string | null;
};

async function authHeaders(): Promise<Record<string, string>> {
  const token = await refreshAccessTokenIfNeeded();
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
}

async function findBackupFileId(): Promise<string | null> {
  const stored = await getDriveFileId();
  if (stored) return stored;

  const headers = await authHeaders();
  const q = encodeURIComponent(`name='${BACKUP_NAME}' and trashed=false`);
  const res = await fetch(`${DRIVE_FILES}?q=${q}&spaces=drive&fields=files(id,name)`, {
    headers,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Drive: nelze najít zálohu (${res.status}) ${text}`);
  }
  const data = (await res.json()) as { files?: { id: string }[] };
  const id = data.files?.[0]?.id ?? null;
  if (id) await setDriveFileId(id);
  return id;
}

export async function uploadBackupToDrive(
  snapshot: WatchlistSnapshot,
  allowRetry = true
): Promise<{ fileId: string; exportedAt: string }> {
  const backup = createBackupPayload(snapshot);
  const json = JSON.stringify(backup, null, 2);
  const existingId = await findBackupFileId();
  const headers = await authHeaders();

  if (existingId) {
    const res = await fetch(
      `${DRIVE_UPLOAD}/${existingId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: json,
      }
    );
    if (!res.ok) {
      const text = await res.text();
      if (res.status === 404 && allowRetry) {
        await clearDriveFileId();
        return uploadBackupToDrive(snapshot, false);
      }
      throw new Error(`Upload na Drive selhal (${res.status}): ${text}`);
    }
    return { fileId: existingId, exportedAt: backup.exportedAt };
  }

  const boundary = `watchlist_${Date.now()}`;
  const metadata = {
    name: BACKUP_NAME,
    mimeType: 'application/json',
    description: 'Automatická záloha aplikace WatchList',
  };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${json}\r\n` +
    `--${boundary}--`;

  const res = await fetch(`${DRIVE_UPLOAD}?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vytvoření zálohy na Drive selhalo (${res.status}): ${text}`);
  }

  const created = (await res.json()) as { id: string };
  await setDriveFileId(created.id);
  return { fileId: created.id, exportedAt: backup.exportedAt };
}

export async function downloadBackupFromDrive(): Promise<WatchlistBackup> {
  const backup = await tryDownloadBackupFromDrive();
  if (!backup) {
    throw new Error('Na Google Drive zatím žádná záloha WatchList není.');
  }
  return backup;
}

/** Vrátí null, když na Drive ještě není žádná záloha. */
export async function tryDownloadBackupFromDrive(): Promise<WatchlistBackup | null> {
  const fileId = await findBackupFileId();
  if (!fileId) return null;

  const headers = await authHeaders();
  const res = await fetch(`${DRIVE_FILES}/${fileId}?alt=media`, { headers });
  if (res.status === 404) {
    await clearDriveFileId();
    return null;
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stažení zálohy selhalo (${res.status}): ${text}`);
  }
  const raw = await res.text();
  return parseBackup(raw);
}

export function snapshotItemCount(snapshot: { items: Record<string, unknown> }): number {
  return Object.keys(snapshot.items || {}).length;
}
