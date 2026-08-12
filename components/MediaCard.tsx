import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { MediaPoster } from '@/components/MediaPoster';
import { TypeBadge } from '@/components/TypeBadge';
import type { MediaType, SeasonProgress, WatchItem } from '@/src/types';
import { colors, radius, spacing } from '@/src/theme/colors';
import { tvProgressLabel } from '@/src/utils/format';

/** Minimum for list cards — full WatchItem or credit + store merge */
export type MediaCardItem = {
  id: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  year?: string;
  tmdbRating?: number | null;
  rating?: number | null;
  genres?: { id: number; name: string }[];
  comment?: string;
  seasons?: Record<number, SeasonProgress>;
};

interface Props {
  item: MediaCardItem;
  /** e.g. character / job on person page */
  roleLabel?: string | null;
}

function formatRating(n: number | null | undefined) {
  if (n == null || n <= 0) return null;
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

export function MediaCard({ item, roleLabel }: Props) {
  const progress =
    item.mediaType === 'tv' && item.seasons
      ? tvProgressLabel(item as WatchItem)
      : null;
  const genres = (item.genres || []).slice(0, 3).map((g) => g.name).join(' · ');
  const myRating = formatRating(item.rating);
  const tmdbRating = formatRating(item.tmdbRating);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() =>
        router.push({
          pathname: item.mediaType === 'movie' ? '/movie/[id]' : '/tv/[id]',
          params: { id: String(item.id) },
        })
      }
    >
      <MediaPoster path={item.posterPath} width={84} height={126} />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <TypeBadge type={item.mediaType} compact />
          {item.year ? <Text style={styles.year}>{item.year}</Text> : null}
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        {roleLabel ? (
          <Text style={styles.role} numberOfLines={1}>
            {roleLabel}
          </Text>
        ) : null}
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
          {progress ? (
            <View style={styles.metaItem}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={styles.metaText}>{progress}</Text>
            </View>
          ) : null}
          {item.comment ? (
            <Ionicons name="chatbubble-outline" size={13} color={colors.textMuted} />
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
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
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
  },
  role: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textMuted,
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
    marginTop: 2,
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
});
