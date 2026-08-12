import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getGoogleClientIds, hasGoogleClientConfigured } from '@/src/services/googleAuth';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

export function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

export function isNativeGoogleSignInAvailable(): boolean {
  return Platform.OS !== 'web' && !isExpoGo();
}

let configured = false;

export async function configureGoogleSignIn(): Promise<void> {
  if (configured || !isNativeGoogleSignInAvailable()) return;

  const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
  const { webClientId } = getGoogleClientIds();

  if (!webClientId) {
    throw new Error('Chybí EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID v .env');
  }

  GoogleSignin.configure({
    webClientId,
    offlineAccess: false,
    scopes: [DRIVE_SCOPE],
    forceCodeForRefreshToken: false,
  });
  configured = true;
}

export async function signInWithGoogleNative(): Promise<{
  accessToken: string;
  email: string | null;
  expiresIn: number;
}> {
  if (isExpoGo()) {
    throw new Error(
      'Google Drive v mobilu vyžaduje development build (ne Expo Go).\n\nSpusť: npx expo run:android'
    );
  }
  if (Platform.OS === 'web') {
    throw new Error('Na webu použij manuální JSON zálohu, nebo připoj Drive z mobilní appky.');
  }
  if (!hasGoogleClientConfigured()) {
    throw new Error('Chybí Google Client ID v .env');
  }

  const { GoogleSignin, isSuccessResponse } =
    await import('@react-native-google-signin/google-signin');

  await configureGoogleSignIn();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) {
    throw new Error('Přihlášení bylo zrušeno.');
  }

  // Požádej o Drive scope (pokud ještě není udělený)
  try {
    await GoogleSignin.addScopes({ scopes: [DRIVE_SCOPE] });
  } catch {
    // už může být udělený
  }

  const tokens = await GoogleSignin.getTokens();
  if (!tokens.accessToken) {
    throw new Error('Nepodařilo se získat přístupový token od Google.');
  }

  const email = response.data.user.email ?? null;
  return {
    accessToken: tokens.accessToken,
    email,
    expiresIn: 3600,
  };
}

export async function refreshNativeAccessToken(): Promise<string | null> {
  if (!isNativeGoogleSignInAvailable()) return null;
  try {
    const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
    await configureGoogleSignIn();
    const current = GoogleSignin.getCurrentUser();
    if (!current) {
      // Zkus tiché obnovení session
      try {
        await GoogleSignin.signInSilently();
      } catch {
        return null;
      }
    }
    const tokens = await GoogleSignin.getTokens();
    return tokens.accessToken || null;
  } catch {
    return null;
  }
}

export async function signOutGoogleNative(): Promise<void> {
  if (!isNativeGoogleSignInAvailable()) return;
  try {
    const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
    const current = GoogleSignin.getCurrentUser();
    if (current) {
      await GoogleSignin.signOut();
    }
  } catch {
    // ignore
  }
}

export function mapGoogleSignInError(error: unknown): string {
  const err = error as { code?: string | number; message?: string };
  const code = String(err?.code ?? '');
  const message = err?.message || (error instanceof Error ? error.message : '');

  if (
    code === '10' ||
    code === 'DEVELOPER_ERROR' ||
    message.includes('DEVELOPER_ERROR') ||
    message.includes('Developer console is not set up correctly')
  ) {
    return (
      'DEVELOPER_ERROR = špatná konfigurace v Google Cloud.\n\n' +
      'EAS APK má JINÝ podpis než lokální debug build.\n\n' +
      '1) OAuth klient typu Android\n' +
      '   • Package: com.watchlist.app\n' +
      '   • SHA-1 z EAS keystore (ne z debug.keystore)\n' +
      '2) V appce musí být WEB Client ID (ne Android ID)\n' +
      '3) Po změně v Console počkej pár minut\n\n' +
      'SHA-1 z EAS:\n' +
      'eas credentials -p android\n' +
      '→ profil apk / preview → Keystore → SHA-1 fingerprint\n\n' +
      'Do Google Console můžeš přidat víc SHA-1 (debug + EAS).'
    );
  }
  if (code === 'SIGN_IN_CANCELLED' || message.includes('canceled') || message.includes('cancelled')) {
    return 'Přihlášení bylo zrušeno.';
  }
  if (code === 'IN_PROGRESS') {
    return 'Přihlášení už probíhá.';
  }
  if (code === 'PLAY_SERVICES_NOT_AVAILABLE') {
    return 'Google Play Services nejsou dostupná.';
  }
  return message || 'Přihlášení selhalo.';
}
