import {
  BebasNeue_400Regular,
} from '@expo-google-fonts/bebas-neue';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import 'react-native-reanimated';
import { useAutoDriveBackup } from '@/hooks/useAutoDriveBackup';
import { colors } from '@/src/theme/colors';
import { useDriveStore } from '@/src/store/driveStore';
import { useWatchlistStore } from '@/src/store/watchlistStore';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    BebasNeue_400Regular,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });
  const hydrated = useWatchlistStore((s) => s.hydrated);
  const hydrateFromDb = useWatchlistStore((s) => s.hydrateFromDb);
  const driveConnected = useDriveStore((s) => s.connected);
  const driveAutoBackup = useDriveStore((s) => s.autoBackup);

  useAutoDriveBackup(hydrated && driveConnected && driveAutoBackup);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    void hydrateFromDb();
  }, [hydrateFromDb]);

  useEffect(() => {
    if (loaded && hydrated) {
      SplashScreen.hideAsync();
      const {
        checkForUpdates,
        enrichMissingMetadata,
        items,
        lastNotificationCheck,
      } = useWatchlistStore.getState();

      // Jen položky bez metadataSynced — už uložené žánry/lidi se z API netahají
      enrichMissingMetadata().catch(() => undefined);

      const itemCount = Object.keys(items).length;
      if (itemCount === 0) return;
      const last = lastNotificationCheck ? new Date(lastNotificationCheck).getTime() : 0;
      const sixHours = 6 * 60 * 60 * 1000;
      if (Date.now() - last > sixHours) {
        checkForUpdates().catch(() => undefined);
      }
    }
  }, [loaded, hydrated]);

  if (!loaded || !hydrated) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: 'DMSans_600SemiBold' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="movie/[id]"
          options={{ title: 'Film', headerBackTitle: 'Zpět' }}
        />
        <Stack.Screen
          name="tv/[id]"
          options={{ title: 'Seriál', headerBackTitle: 'Zpět' }}
        />
        <Stack.Screen
          name="person/[id]"
          options={{ title: 'Osoba', headerBackTitle: 'Zpět' }}
        />
        <Stack.Screen
          name="settings"
          options={{ title: 'Nastavení', presentation: 'modal' }}
        />
      </Stack>
    </>
  );
}
