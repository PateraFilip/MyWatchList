import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEYS = {
  accessToken: 'gdrive_access_token',
  refreshToken: 'gdrive_refresh_token',
  expiresAt: 'gdrive_expires_at',
  email: 'gdrive_email',
  fileId: 'gdrive_file_id',
} as const;

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
  email: string | null;
}

export function getGoogleClientIds() {
  return {
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || '',
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() || '',
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || '',
  };
}

export function hasGoogleClientConfigured(): boolean {
  const ids = getGoogleClientIds();
  return Boolean(ids.webClientId || ids.androidClientId || ids.iosClientId);
}

/** Client ID pro aktuální platformu (fallback na web). */
export function getActiveGoogleClientId(): string {
  const ids = getGoogleClientIds();
  if (Platform.OS === 'android' && ids.androidClientId) return ids.androidClientId;
  if (Platform.OS === 'ios' && ids.iosClientId) return ids.iosClientId;
  return ids.webClientId || ids.androidClientId || ids.iosClientId;
}

export async function saveGoogleTokens(tokens: {
  accessToken: string;
  refreshToken?: string | null;
  expiresIn?: number | null;
  email?: string | null;
}): Promise<void> {
  await SecureStore.setItemAsync(KEYS.accessToken, tokens.accessToken);
  if (tokens.refreshToken) {
    await SecureStore.setItemAsync(KEYS.refreshToken, tokens.refreshToken);
  }
  if (tokens.expiresIn) {
    const expiresAt = String(Date.now() + tokens.expiresIn * 1000 - 60_000);
    await SecureStore.setItemAsync(KEYS.expiresAt, expiresAt);
  }
  if (tokens.email) {
    await SecureStore.setItemAsync(KEYS.email, tokens.email);
  }
}

export async function loadGoogleTokens(): Promise<GoogleTokens | null> {
  const accessToken = await SecureStore.getItemAsync(KEYS.accessToken);
  if (!accessToken) return null;
  const refreshToken = await SecureStore.getItemAsync(KEYS.refreshToken);
  const expiresAtRaw = await SecureStore.getItemAsync(KEYS.expiresAt);
  const email = await SecureStore.getItemAsync(KEYS.email);
  return {
    accessToken,
    refreshToken,
    expiresAt: expiresAtRaw ? Number(expiresAtRaw) : null,
    email,
  };
}

export async function clearGoogleTokens(): Promise<void> {
  await Promise.all(
    Object.values(KEYS).map((key) => SecureStore.deleteItemAsync(key).catch(() => undefined))
  );
}

export async function getDriveFileId(): Promise<string | null> {
  const id = await SecureStore.getItemAsync(KEYS.fileId);
  return id || null;
}

export async function setDriveFileId(fileId: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.fileId, fileId);
}

export async function clearDriveFileId(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.fileId).catch(() => undefined);
}

export async function refreshAccessTokenIfNeeded(): Promise<string> {
  // Nativní Google Sign-In obnoví token sám (preferované na mobilu)
  try {
    const { refreshNativeAccessToken } = await import('@/src/services/googleSignIn');
    const nativeToken = await refreshNativeAccessToken();
    if (nativeToken) {
      await saveGoogleTokens({ accessToken: nativeToken, expiresIn: 3600 });
      return nativeToken;
    }
  } catch {
    // spadni na uložené tokeny
  }

  const tokens = await loadGoogleTokens();
  if (!tokens) {
    throw new Error('Nejsi přihlášený ke Google Drive.');
  }

  const stillValid =
    tokens.expiresAt == null || Date.now() < tokens.expiresAt;
  if (stillValid) {
    return tokens.accessToken;
  }

  if (!tokens.refreshToken) {
    throw new Error('Vypršelo přihlášení ke Google. Připoj Drive znovu v Nastavení.');
  }

  const clientId = getActiveGoogleClientId();
  if (!clientId) {
    throw new Error('Chybí Google OAuth Client ID v .env');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: tokens.refreshToken,
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error('Vypršelo přihlášení ke Google. Připoj Drive znovu v Nastavení.');
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in?: number;
    refresh_token?: string;
  };

  await saveGoogleTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? tokens.refreshToken,
    expiresIn: data.expires_in ?? 3600,
    email: tokens.email,
  });

  return data.access_token;
}

export async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { email?: string };
    return data.email ?? null;
  } catch {
    return null;
  }
}
