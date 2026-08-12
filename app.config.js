/**
 * Dynamická Expo konfigurace — iosUrlScheme se skládá z Web Client ID.
 * Načti .env přes Expo (EXPO_PUBLIC_*).
 */
const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || '';
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || webClientId;

function toIosUrlScheme(clientId) {
  if (!clientId) return 'com.googleusercontent.apps.placeholder';
  const id = clientId.replace(/\.apps\.googleusercontent\.com$/i, '');
  return `com.googleusercontent.apps.${id}`;
}

export default {
  expo: {
    name: 'My WatchList',
    slug: 'WatchList',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'watchlist',
    userInterfaceStyle: 'dark',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.watchlist.app',
    },
    android: {
      package: 'com.watchlist.app',
      adaptiveIcon: {
        backgroundColor: '#FF6347',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 180,
          resizeMode: 'contain',
          backgroundColor: '#FF6347',
        },
      ],
      [
        'expo-build-properties',
        {
          android: {
            // Menší APK: jen arm64 (moderní telefony) + R8 minify
            enableMinifyInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
            buildArchs: ['arm64-v8a'],
            extraProguardRules: [
              '-keep class com.facebook.react.** { *; }',
              '-keep class com.swmansion.reanimated.** { *; }',
              '-keep class com.swmansion.worklets.** { *; }',
              '-keep class com.google.android.gms.auth.** { *; }',
              '-dontwarn com.google.android.gms.**',
            ].join('\n'),
          },
        },
      ],
      'expo-font',
      'expo-image',
      'expo-sharing',
      'expo-secure-store',
      'expo-sqlite',
      'expo-dev-client',
      [
        '@react-native-google-signin/google-signin',
        {
          iosUrlScheme: toIosUrlScheme(iosClientId),
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      eas: {
        projectId: '916d7c05-5246-4eed-a535-834a642ec009',
      },
    },
    owner: 'galactico',
  },
};

