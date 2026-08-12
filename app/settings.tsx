import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GoogleDriveSection } from '@/components/GoogleDriveSection';
import { hasApiKey } from '@/src/api/tmdb';
import { useWatchlistStore } from '@/src/store/watchlistStore';
import { colors, radius, spacing } from '@/src/theme/colors';
import {
  backupStats,
  createBackupPayload,
  pickBackupFile,
  shareBackupFile,
} from '@/src/utils/backup';

export default function SettingsScreen() {
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const getBackupSnapshot = useWatchlistStore((s) => s.getBackupSnapshot);
  const restoreFromBackup = useWatchlistStore((s) => s.restoreFromBackup);
  const itemCount = useWatchlistStore((s) => Object.keys(s.items).length);

  const [keyHint] = useState(() => {
    const key = process.env.EXPO_PUBLIC_TMDB_API_KEY || '';
    if (!key) return '';
    if (key.length < 8) return '••••';
    return `${key.slice(0, 4)}…${key.slice(-4)}`;
  });

  const onExport = async () => {
    setBusy('export');
    try {
      const payload = createBackupPayload(getBackupSnapshot());
      await shareBackupFile(payload);
    } catch (e) {
      Alert.alert(
        'Export selhal',
        e instanceof Error ? e.message : 'Nepodařilo se vytvořit zálohu.'
      );
    } finally {
      setBusy(null);
    }
  };

  const onImport = async () => {
    setBusy('import');
    try {
      const backup = await pickBackupFile();
      if (!backup) {
        setBusy(null);
        return;
      }

      const stats = backupStats(backup);
      Alert.alert(
        'Obnovit zálohu?',
        `Záloha obsahuje ${stats.total} položek (${stats.watchlist} ke zhlédnutí, ${stats.watched} zhlédnutých).\n\nSoučasná data v appce budou nahrazena.`,
        [
          { text: 'Zrušit', style: 'cancel', onPress: () => setBusy(null) },
          {
            text: 'Obnovit',
            style: 'destructive',
            onPress: () => {
              restoreFromBackup({
                items: backup.items,
                notifications: backup.notifications,
                lastNotificationCheck: backup.lastNotificationCheck,
              });
              setBusy(null);
              Alert.alert('Hotovo', 'Záloha byla obnovena.');
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert(
        'Import selhal',
        e instanceof Error ? e.message : 'Nepodařilo se načíst zálohu.'
      );
      setBusy(null);
    }
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.brand}>WATCHLIST</Text>
      <Text style={styles.lead}>
        Osobní seznam filmů a seriálů s daty z The Movie Database (TMDB).
      </Text>

      <GoogleDriveSection />

      <View style={styles.card}>
        <View style={styles.row}>
          <Ionicons name="document-outline" size={22} color={colors.accent} />
          <Text style={styles.cardTitle}>Manuální záloha (JSON)</Text>
        </View>
        <Text style={styles.cardBody}>
          Data běží v SQLite na telefonu ({itemCount} položek). Exportuj JSON zálohu
          do Google Drive, e-mailu nebo Souborů — a kdykoli ji znovu naimportuj.
        </Text>

        <Pressable
          style={[styles.actionBtn, busy === 'export' && styles.actionBtnDisabled]}
          onPress={onExport}
          disabled={!!busy}
        >
          {busy === 'export' ? (
            <ActivityIndicator color={colors.bg} size="small" />
          ) : (
            <Ionicons name="download-outline" size={18} color={colors.bg} />
          )}
          <Text style={styles.actionBtnText}>Exportovat zálohu</Text>
        </Pressable>

        <Pressable
          style={[styles.actionBtnSecondary, busy === 'import' && styles.actionBtnDisabled]}
          onPress={onImport}
          disabled={!!busy}
        >
          {busy === 'import' ? (
            <ActivityIndicator color={colors.accent} size="small" />
          ) : (
            <Ionicons name="folder-open-outline" size={18} color={colors.accent} />
          )}
          <Text style={styles.actionBtnSecondaryText}>Obnovit ze zálohy</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Ionicons
            name={hasApiKey() ? 'checkmark-circle' : 'alert-circle'}
            size={22}
            color={hasApiKey() ? colors.success : colors.accent}
          />
          <Text style={styles.cardTitle}>TMDB API klíč</Text>
        </View>
        <Text style={styles.cardBody}>
          Do <Text style={styles.mono}>.env</Text> vlož buď krátký{' '}
          <Text style={styles.mono}>API Key</Text> (hex), nebo dlouhý{' '}
          <Text style={styles.mono}>API Read Access Token</Text> (začíná eyJ).
          Bez uvozovek a bez slova Bearer.
        </Text>
        {keyHint ? (
          <Text style={styles.keyHint}>Načtený klíč: {keyHint}</Text>
        ) : (
          <Text style={styles.keyMissing}>Klíč zatím není nastavený.</Text>
        )}

        <TextInput
          editable={false}
          style={styles.disabledInput}
          value="Nastav klíč v .env a restartuj Expo"
          placeholderTextColor={colors.textDim}
        />

        <Pressable
          style={styles.linkBtn}
          onPress={() => Linking.openURL('https://www.themoviedb.org/settings/api')}
        >
          <Ionicons name="open-outline" size={18} color={colors.accent} />
          <Text style={styles.linkText}>Získat API klíč na TMDB</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Jak to funguje</Text>
        <Text style={styles.cardBody}>
          • Data v SQLite (včetně žánrů a lidí — bez zbytečných API callů){'\n'}
          • Google Drive: automatická záloha po připojení účtu{'\n'}
          • Nebo manuální JSON export{'\n'}
          • Seriály: označuj jednotlivé série a díly{'\n'}
          • Novinky: kontrola nových sérií a filmů v kolekcích{'\n'}
          • Hodnocení 1–10 a vlastní komentáře
        </Text>
      </View>

      <Text style={styles.footer}>
        This product uses the TMDB API but is not endorsed or certified by TMDB.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: 40,
  },
  brand: {
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 40,
    color: colors.accent,
    letterSpacing: 2,
  },
  lead: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
    marginTop: -8,
  },
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
  keyHint: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: colors.success,
  },
  keyMissing: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: colors.accent,
  },
  disabledInput: {
    marginTop: spacing.sm,
    backgroundColor: colors.bgSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.textDim,
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
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
  actionBtnDisabled: {
    opacity: 0.6,
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
  footer: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: colors.textDim,
    lineHeight: 16,
  },
});
