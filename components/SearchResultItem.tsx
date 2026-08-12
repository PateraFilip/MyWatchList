import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { MediaPoster } from '@/components/MediaPoster';
import { TypeBadge } from '@/components/TypeBadge';
import {
  genresFromIds,
  mediaTitle,
  mediaYear,
  type GenreMaps,
} from '@/src/api/tmdb';
import type { MediaType, TmdbSearchResult } from '@/src/types';
import { useWatchlistStore } from '@/src/store/watchlistStore';
import { colors, radius, spacing } from '@/src/theme/colors';

interface Props {
  item: TmdbSearchResult;
  genreMaps?: GenreMaps | null;
}

function formatRating(n: number | null | undefined) {
  if (n == null || n <= 0) return null;
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

function PersonResultItem({ item }: { item: TmdbSearchResult }) {
  const knownFor = (item.known_for || [])
    .slice(0, 3)
    .map((k) => mediaTitle(k))
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() =>
        router.push({
          pathname: '/person/[id]',
          params: { id: String(item.id) },
        })
      }
    >
      <MediaPoster
        path={item.profile_path}
        width={84}
        height={126}
        placeholderIcon="person-outline"
      />

      <View style={styles.content}>
        <View style={styles.topRow}>
          <TypeBadge type="person" compact />
          {item.known_for_department ? (
            <Text style={styles.year}>{item.known_for_department}</Text>
          ) : null}
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {item.name || 'Bez jména'}
        </Text>
        {knownFor ? (
          <Text style={styles.genres} numberOfLines={2}>
            {knownFor}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
    </Pressable>
  );
}

function MediaResultItem({
  item,
  genreMaps,
}: {
  item: TmdbSearchResult;
  genreMaps?: GenreMaps | null;
}) {
  const mediaType = item.media_type as MediaType;
  const stored = useWatchlistStore((s) => s.getItem(mediaType, item.id));
  const addItem = useWatchlistStore((s) => s.addItem);

  const year = mediaYear(item) || stored?.year;
  const tmdbRating = formatRating(item.vote_average ?? stored?.tmdbRating);
  const myRating = formatRating(stored?.rating);
  const genreList =
    stored?.genres && stored.genres.length > 0
      ? stored.genres
      : genresFromIds(mediaType, item.genre_ids, genreMaps);
  const genres = genreList.slice(0, 3).map((g) => g.name).join(' · ');

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() =>
        router.push({
          pathname: mediaType === 'movie' ? '/movie/[id]' : '/tv/[id]',
          params: { id: String(item.id) },
        })
      }
    >
      <MediaPoster path={item.poster_path || stored?.posterPath} width={84} height={126} />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <TypeBadge type={mediaType} compact />
          {year ? <Text style={styles.year}>{year}</Text> : null}
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {mediaTitle(item)}
        </Text>
        {genres ? (
          <Text style={styles.genres} numberOfLines={1}>
            {genres}
          </Text>
        ) : null}
        <View style={styles.meta}>
          {tmdbRating ? (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>TMDB</Text>
              <Text style={styles.metaText}>{tmdbRating}</Text>
            </View>
          ) : null}
          {myRating ? (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Moje</Text>
              <Text style={[styles.metaText, styles.myRating]}>{myRating}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.actions}>
        {stored ? (
          <Ionicons
            name={stored.status === 'watched' ? 'checkmark-circle' : 'bookmark'}
            size={22}
            color={stored.status === 'watched' ? colors.success : colors.accent}
          />
        ) : (
          <>
            <Pressable
              style={styles.iconBtn}
              onPress={() => addItem(item, mediaType, 'watchlist')}
              hitSlop={8}
            >
              <Ionicons name="bookmark-outline" size={20} color={colors.accent} />
            </Pressable>
            <Pressable
              style={styles.iconBtn}
              onPress={() => addItem(item, mediaType, 'watched')}
              hitSlop={8}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} />
            </Pressable>
          </>
        )}
      </View>
    </Pressable>
  );
}

export function SearchResultItem({ item, genreMaps }: Props) {
  if (item.media_type === 'person') {
    return <PersonResultItem item={item} />;
  }
  return <MediaResultItem item={item} genreMaps={genreMaps} />;
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.85,
  },
  content: {
    flex: 1,
    gap: 5,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  year: {
    fontFamily: 'DMSans_400Regular',
    color: colors.textDim,
    fontSize: 12,
  },
  title: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 16,
    color: colors.text,
    lineHeight: 22,
  },
  genres: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textDim,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    color: colors.textDim,
    textTransform: 'uppercase',
  },
  metaText: {
    fontFamily: 'DMSans_600SemiBold',
    color: colors.textMuted,
    fontSize: 13,
  },
  myRating: {
    color: colors.accent,
  },
  actions: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
