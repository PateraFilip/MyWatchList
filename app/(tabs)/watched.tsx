import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '@/components/EmptyState';
import { ListFiltersModal } from '@/components/ListFiltersModal';
import { MediaCard } from '@/components/MediaCard';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useWatchlistStore } from '@/src/store/watchlistStore';
import type { ListFilterState } from '@/src/types';
import { DEFAULT_LIST_FILTERS } from '@/src/types';
import { colors, spacing } from '@/src/theme/colors';
import { applyListFilters, countActiveFilters } from '@/src/utils/listFilters';
import { itemAppearsInList } from '@/src/utils/tvProgress';

export default function WatchedScreen() {
  const allItems = useWatchlistStore((s) => s.items);
  const [filters, setFilters] = useState<ListFilterState>(DEFAULT_LIST_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const statusItems = useMemo(
    () => Object.values(allItems).filter((i) => itemAppearsInList(i, 'watched')),
    [allItems]
  );

  const filtered = useMemo(
    () => applyListFilters(Object.values(allItems), 'watched', filters),
    [allItems, filters]
  );

  const activeCount = countActiveFilters(filters);
  const subtitle = `${filtered.length} z ${statusItems.length}${
    activeCount ? ' · filtry aktivní' : ''
  }`;

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="ZHLÉDNUTÉ"
        subtitle={subtitle}
        right={
          <Pressable
            style={styles.iconBtn}
            onPress={() => setFiltersOpen(true)}
            hitSlop={8}
          >
            <Ionicons name="options-outline" size={22} color={colors.textMuted} />
            {activeCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{activeCount}</Text>
              </View>
            ) : null}
          </Pressable>
        }
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => `${item.mediaType}-${item.id}`}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          <EmptyState
            icon="checkmark-done-outline"
            title={statusItems.length ? 'Nic neodpovídá filtrům' : 'Zatím nic zhlédnutého'}
            subtitle={
              statusItems.length
                ? 'Uprav nebo resetuj filtry.'
                : 'Označ filmy a seriály jako zhlédnuté a uvidíš je tady.'
            }
          />
        }
        renderItem={({ item }) => <MediaCard item={item} />}
      />

      <ListFiltersModal
        visible={filtersOpen}
        value={filters}
        onChange={setFilters}
        onClose={() => setFiltersOpen(false)}
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
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 10,
    color: colors.bg,
  },
  list: {
    paddingVertical: spacing.md,
    paddingBottom: 40,
    flexGrow: 1,
  },
});
