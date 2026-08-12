import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { hasGoogleClientConfigured } from '@/src/services/googleAuth';
import {
  isExpoGo,
  isNativeGoogleSignInAvailable,
  mapGoogleSignInError,
  signInWithGoogleNative,
} from '@/src/services/googleSignIn';
import { useDriveStore } from '@/src/store/driveStore';
import { colors, radius, spacing } from '@/src/theme/colors';

export function GoogleDriveSection() {
  const connected = useDriveStore((s) => s.connected);
  const email = useDriveStore((s) => s.email);
  const autoBackup = useDriveStore((s) => s.autoBackup);
  const lastBackupAt = useDriveStore((s) => s.lastBackupAt);
  const lastError = useDriveStore((s) => s.lastError);
  const syncing = useDriveStore((s) => s.syncing);
  const setAutoBackup = useDriveStore((s) => s.setAutoBackup);
  const connectWithTokens = useDriveStore((s) => s.connectWithTokens);
  const syncAfterConnect = useDriveStore((s) => s.syncAfterConnect);
  const disconnect = useDriveStore((s) => s.disconnect);
  const restoreSession = useDriveStore((s) => s.restoreSession);
  const backupNow = useDriveStore((s) => s.backupNow);
  const restoreFromDrive = useDriveStore((s) => s.restoreFromDrive);

  const [busy, setBusy] = useState(false);
  const configured = hasGoogleClientConfigured();
  const expoGo = isExpoGo();
  const nativeOk = isNativeGoogleSignInAvailable();

  useEffect(() => {
    restoreSession().catch(() => undefined);
  }, [restoreSession]);

  const onConnect = async () => {
    if (!configured) {
      Alert.alert(
        'Chybí Google Client ID',
        'Do .env přidej EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID a vytvoř Android OAuth klienta (viz README).'
      );
      return;
    }
    if (expoGo) {
      Alert.alert(
        'Potřebuješ development build',
        'Google přihlášení v telefonu nefunguje v Expo Go.\n\n1) Nastav Android OAuth client (package com.watchlist.app + SHA-1)\n2) Spusť: npx expo run:android\n3) Otevři nainstalovanou appku WatchList a připoj Drive.'
      );
      return;
    }

    setBusy(true);
    try {
      const result = await signInWithGoogleNative();
      await connectWithTokens({
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
        refreshToken: null,
        email: result.email,
      });

      const sync = await syncAfterConnect();
      if (sync.action === 'restored') {
        Alert.alert(
          'Google Drive',
          `Účet připojen. Z Drive se obnovilo ${sync.remoteCount} položek — prázdný telefon nepřepsal zálohu.`
        );
      } else if (sync.action === 'uploaded') {
        Alert.alert(
          'Google Drive',
          'Účet připojen. Lokální data byla nahrána na Drive. Záloha poběží automaticky.'
        );
      } else if (sync.action === 'needs_choice') {
        Alert.alert(
          'Konflikt záloh',
          `V telefonu je ${sync.localCount} položek, na Drive ${sync.remoteCount}.\n\n` +
            'Co chceš udělat?',
          [
            {
              text: 'Obnovit z Drive',
              onPress: async () => {
                try {
                  const count = await restoreFromDrive();
                  Alert.alert('Hotovo', `Obnoveno ${count} položek z Drive.`);
                } catch (e) {
                  Alert.alert(
                    'Chyba',
                    e instanceof Error ? e.message : 'Obnova selhala.'
                  );
                }
              },
            },
            {
              text: 'Nahrát z telefonu',
              style: 'destructive',
              onPress: async () => {
                try {
                  await backupNow({ force: true });
                  Alert.alert('Hotovo', 'Lokální data přepsala zálohu na Drive.');
                } catch (e) {
                  Alert.alert(
                    'Chyba',
                    e instanceof Error ? e.message : 'Záloha selhala.'
                  );
                }
              },
            },
            { text: 'Později', style: 'cancel' },
          ]
        );
      } else {
        Alert.alert(
          'Google Drive',
          'Účet připojen. Až něco přidáš, záloha se uloží automaticky.'
        );
      }
    } catch (e) {
      Alert.alert('Google Drive', mapGoogleSignInError(e));
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = () => {
    Alert.alert('Odpojit Google Drive?', 'Automatická záloha se vypne. Lokální data zůstanou.', [
      { text: 'Zrušit', style: 'cancel' },
      {
        text: 'Odpojit',
        style: 'destructive',
        onPress: () => disconnect(),
      },
    ]);
  };

  const onBackupNow = async () => {
    setBusy(true);
    try {
      await backupNow();
      Alert.alert('Hotovo', 'Záloha byla nahrána na Google Drive.');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Záloha selhala.';
      if (message.includes('víc položek') || message.includes('prázdný')) {
        Alert.alert('Pozor', message, [
          { text: 'Zrušit', style: 'cancel' },
          {
            text: 'Přesto nahrát',
            style: 'destructive',
            onPress: async () => {
              setBusy(true);
              try {
                await backupNow({ force: true });
                Alert.alert('Hotovo', 'Záloha na Drive byla přepsána.');
              } catch (err) {
                Alert.alert(
                  'Chyba',
                  err instanceof Error ? err.message : 'Záloha selhala.'
                );
              } finally {
                setBusy(false);
              }
            },
          },
        ]);
      } else {
        Alert.alert('Chyba', message);
      }
    } finally {
      setBusy(false);
    }
  };

  const onRestore = () => {
    Alert.alert(
      'Obnovit z Google Drive?',
      'Současná data v appce budou nahrazena zálohou z Drive.',
      [
        { text: 'Zrušit', style: 'cancel' },
        {
          text: 'Obnovit',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              const count = await restoreFromDrive();
              Alert.alert('Hotovo', `Obnoveno ${count} položek z Google Drive.`);
            } catch (e) {
              Alert.alert('Chyba', e instanceof Error ? e.message : 'Obnova selhala.');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Ionicons name="logo-google" size={22} color={colors.accent} />
        <Text style={styles.cardTitle}>Google Drive</Text>
      </View>

      <Text style={styles.cardBody}>
        Automatická záloha do souboru{' '}
        <Text style={styles.mono}>WatchList-backup.json</Text> na Google Disku.
        Při připojení na novém telefonu se nejdřív obnoví existující záloha — prázdný
        telefon ji nepřepíše.
      </Text>

      {expoGo ? (
        <View style={styles.warnBox}>
          <Text style={styles.warnText}>
            Právě běžíš v Expo Go — Google Sign-In v něm nejde. Nainstaluj development build:
          </Text>
          <Text style={styles.monoBlock}>npx expo run:android</Text>
          <Text style={styles.warnText}>
            Package name: <Text style={styles.mono}>com.watchlist.app</Text>
            {'\n'}
            Do Google Console přidej OAuth klienta typu <Text style={styles.mono}>Android</Text> s
            package <Text style={styles.mono}>com.watchlist.app</Text> a SHA-1 z EAS keystore
            (<Text style={styles.mono}>eas credentials -p android</Text>).

          </Text>
        </View>
      ) : null}

      {!configured ? (
        <View style={styles.warnBox}>
          <Text style={styles.warnText}>
            Nastav <Text style={styles.mono}>EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID</Text> v .env a Android
            OAuth klienta v Google Cloud.
          </Text>
          <Pressable
            onPress={() =>
              Linking.openURL('https://console.cloud.google.com/apis/credentials')
            }
          >
            <Text style={styles.linkText}>Otevřít Google Cloud Console</Text>
          </Pressable>
        </View>
      ) : null}

      {connected ? (
        <>
          <View style={styles.statusRow}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.statusText}>{email || 'Připojeno'}</Text>
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Automatická záloha</Text>
            <Switch
              value={autoBackup}
              onValueChange={setAutoBackup}
              trackColor={{ false: colors.border, true: colors.accentDark }}
              thumbColor={autoBackup ? colors.accent : colors.textDim}
            />
          </View>

          {lastBackupAt ? (
            <Text style={styles.meta}>
              Poslední záloha: {new Date(lastBackupAt).toLocaleString('cs-CZ')}
            </Text>
          ) : (
            <Text style={styles.meta}>Zatím neproběhla žádná záloha.</Text>
          )}

          {lastError ? <Text style={styles.error}>{lastError}</Text> : null}

          <Pressable
            style={styles.actionBtn}
            onPress={onBackupNow}
            disabled={busy || syncing}
          >
            {busy || syncing ? (
              <ActivityIndicator color={colors.bg} size="small" />
            ) : (
              <Ionicons name="cloud-upload-outline" size={18} color={colors.bg} />
            )}
            <Text style={styles.actionBtnText}>Zálohovat teď</Text>
          </Pressable>

          <Pressable
            style={styles.actionBtnSecondary}
            onPress={onRestore}
            disabled={busy || syncing}
          >
            <Ionicons name="cloud-download-outline" size={18} color={colors.accent} />
            <Text style={styles.actionBtnSecondaryText}>Obnovit z Drive</Text>
          </Pressable>

          <Pressable style={styles.linkBtn} onPress={onDisconnect}>
            <Ionicons name="log-out-outline" size={18} color={colors.danger} />
            <Text style={[styles.linkText, { color: colors.danger }]}>Odpojit účet</Text>
          </Pressable>
        </>
      ) : (
        <Pressable
          style={[styles.actionBtn, (busy || !configured) && styles.disabled]}
          onPress={onConnect}
          disabled={busy || !configured}
        >
          {busy ? (
            <ActivityIndicator color={colors.bg} size="small" />
          ) : (
            <Ionicons name="logo-google" size={18} color={colors.bg} />
          )}
          <Text style={styles.actionBtnText}>
            {expoGo ? 'Jak spustit na telefonu' : 'Připojit Google Drive'}
          </Text>
        </Pressable>
      )}

      {!nativeOk && !expoGo ? (
        <Text style={styles.meta}>
          Na této platformě použij manuální JSON zálohu níže.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 16,
    color: colors.text,
  },
  cardBody: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 21,
  },
  mono: {
    fontFamily: 'DMSans_600SemiBold',
    color: colors.accent,
  },
  monoBlock: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13,
    color: colors.accent,
    backgroundColor: colors.bgSoft,
    padding: spacing.sm,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  warnBox: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 8,
  },
  warnText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.text,
    lineHeight: 19,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  statusText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: colors.success,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  switchLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: colors.text,
  },
  meta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textDim,
  },
  error: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.danger,
    lineHeight: 17,
  },
  actionBtn: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  actionBtnText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    color: colors.bg,
  },
  actionBtnSecondaryText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    color: colors.accent,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.sm,
  },
  linkText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 14,
    color: colors.accent,
  },
  disabled: {
    opacity: 0.55,
  },
});
