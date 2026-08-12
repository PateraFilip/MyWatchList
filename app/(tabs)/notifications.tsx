import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { EmptyState } from '@/components/EmptyState';
import { useWatchlistStore } from '@/src/store/watchlistStore';
import type { AppNotification } from '@/src/types';
import { colors, radius, spacing } from '@/src/theme/colors';
import {
  formatPremiereDate,
  isNotificationRelevant,
  isReleaseOut,
  relativeDate,
} from '@/src/utils/format';

export default function NotificationsScreen() {
  const notifications = useWatchlistStore((s) => s.notifications);
  const lastCheck = useWatchlistStore((s) => s.lastNotificationCheck);
  const checkForUpdates = useWatchlistStore((s) => s.checkForUpdates);
  const markNotificationRead = useWatchlistStore((s) => s.markNotificationRead);
  const markAllNotificationsRead = useWatchlistStore((s) => s.markAllNotificationsRead);
  const clearNotifications = useWatchlistStore((s) => s.clearNotifications);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const relevant = useMemo(
    () => notifications.filter((n) => isNotificationRelevant(n, 30)),
    [notifications]
  );

  const upcoming = useMemo(
    () =>
      relevant
        .filter((n) => n.type === 'upcoming_release')
        .sort((a, b) => {
          // Nejdřív „už vyšlo“, pak podle data
          const aOut = isReleaseOut(a.releaseDate) ? 0 : 1;
          const bOut = isReleaseOut(b.releaseDate) ? 0 : 1;
          if (aOut !== bOut) return aOut - bOut;
          return (a.releaseDate || '9999').localeCompare(b.releaseDate || '9999');
        }),
    [relevant]
  );
  const news = useMemo(
    () => relevant.filter((n) => n.type !== 'upcoming_release'),
    [relevant]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setStatus(null);
    try {
      const count = await checkForUpdates();
      setStatus(
        count > 0
          ? `Aktualizováno (${count} položek v přehledu)`
          : 'Žádné nové série ani filmy'
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Kontrola selhala');
    } finally {
      setRefreshing(false);
    }
  }, [checkForUpdates]);

  const openItem = (n: AppNotification) => {
    markNotificationRead(n.id);
    router.push({
      pathname: n.mediaType === 'movie' ? '/movie/[id]' : '/tv/[id]',
      params: { id: String(n.tmdbId) },
    });
  };

  const renderNotification = (item: AppNotification) => {
    const premiere = formatPremiereDate(item.releaseDate);
    const released = isReleaseOut(item.releaseDate);
    const iconName =
      item.type === 'new_season'
        ? 'tv-outline'
        : item.type === 'upcoming_release'
          ? released
            ? 'checkmark-circle'
            : 'calendar-outline'
          : 'film-outline';
    const iconColor = released
      ? colors.success
      : item.type === 'new_season'
        ? colors.tv
        : item.type === 'upcoming_release'
          ? colors.accent
          : colors.movie;
    const iconBg = released
      ? colors.successSoft
      : item.type === 'new_season'
        ? colors.tvSoft
        : item.type === 'upcoming_release'
          ? colors.accentSoft
          : colors.movieSoft;

    return (
      <Pressable
        style={[
          styles.card,
          released && styles.cardReleased,
          !item.read && item.type !== 'upcoming_release' && styles.cardUnread,
        ]}
        onPress={() => openItem(item)}
      >
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={iconName} size={20} color={iconColor} />
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>
            {released ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Vyšlo</Text>
              </View>
            ) : item.releaseDate ? (
              <View style={[styles.badge, styles.badgeSoon]}>
                <Text style={[styles.badgeText, styles.badgeSoonText]}>Brzy</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.message}>{item.message}</Text>
          {premiere ? (
            <Text style={[styles.premiere, released && styles.premiereOut]}>
              {released ? `Vyšlo ${premiere}` : premiere}
            </Text>
          ) : (
            <Text style={styles.date}>{relativeDate(item.createdAt)}</Text>
          )}
        </View>
        {!item.read && item.type !== 'upcoming_release' ? (
          <View style={styles.dot} />
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <Pressable style={styles.toolBtn} onPress={onRefresh} disabled={refreshing}>
          {refreshing ? (
            <ActivityIndicator color={colors.accent} size="small" />
          ) : (
            <Ionicons name="refresh" size={18} color={colors.accent} />
          )}
          <Text style={styles.toolText}>Zkontrolovat</Text>
        </Pressable>
        <Pressable style={styles.toolBtn} onPress={markAllNotificationsRead}>
          <Ionicons name="mail-open-outline" size={18} color={colors.textMuted} />
          <Text style={[styles.toolText, { color: colors.textMuted }]}>Přečíst vše</Text>
        </Pressable>
        <Pressable style={styles.toolBtn} onPress={clearNotifications}>
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
          <Text style={[styles.toolText, { color: colors.danger }]}>Smazat</Text>
        </Pressable>
      </View>

      {status ? <Text style={styles.status}>{status}</Text> : null}
      {lastCheck ? (
        <Text style={styles.lastCheck}>
          Poslední kontrola: {new Date(lastCheck).toLocaleString('cs-CZ')}
          {'\n'}Zobrazují se novinky max. měsíc staré.
        </Text>
      ) : (
        <Text style={styles.lastCheck}>
          Watchlist → premiéry (max. měsíc po vydání). Zhlédnuté → nové série a kolekce.
        </Text>
      )}

      <FlatList
        data={[
          ...(upcoming.length
            ? [{ kind: 'header' as const, id: 'h-upcoming', title: 'Watchlist — premiéry' }]
            : []),
          ...upcoming.map((n) => ({ kind: 'item' as const, id: n.id, notification: n })),
          ...(news.length
            ? [{ kind: 'header' as const, id: 'h-news', title: 'Novinky ze zhlédnutých' }]
            : []),
          ...news.map((n) => ({ kind: 'item' as const, id: n.id, notification: n })),
        ]}
        keyExtractor={(row) => row.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          <EmptyState
            icon="notifications-outline"
            title="Žádné novinky"
            subtitle="Zobrazují se jen položky z posledního měsíce (a budoucí premiéry)."
          />
        }
        renderItem={({ item: row }) => {
          if (row.kind === 'header') {
            return <Text style={styles.section}>{row.title}</Text>;
          }
          return renderNotification(row.notification);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
  },
  toolbar: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toolText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    color: colors.accent,
  },
  status: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: colors.accent,
    marginTop: spacing.md,
  },
  lastCheck: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textDim,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  list: {
    paddingVertical: spacing.lg,
    paddingBottom: 40,
    flexGrow: 1,
  },
  section: {
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 22,
    color: colors.text,
    letterSpacing: 0.5,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'flex-start',
  },
  cardReleased: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  cardUnread: {
    borderColor: colors.accent,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  title: {
    flex: 1,
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    color: colors.text,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.success,
  },
  badgeSoon: {
    backgroundColor: colors.accentSoft,
  },
  badgeText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 10,
    color: colors.bg,
    textTransform: 'uppercase',
  },
  badgeSoonText: {
    color: colors.accent,
  },
  message: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  premiere: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 12,
    color: colors.accent,
    marginTop: 2,
  },
  premiereOut: {
    color: colors.success,
  },
  date: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: colors.textDim,
    marginTop: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginTop: 6,
  },
});
