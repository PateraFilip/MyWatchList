import { StyleSheet, Text, View } from 'react-native';
import type { MediaType } from '@/src/types';
import { colors, radius } from '@/src/theme/colors';
import { mediaTypeLabel } from '@/src/utils/format';

type BadgeType = MediaType | 'person';

interface Props {
  type: BadgeType;
  compact?: boolean;
}

function badgeLabel(type: BadgeType): string {
  if (type === 'person') return 'Osoba';
  return mediaTypeLabel(type);
}

function badgeColors(type: BadgeType): { fg: string; bg: string } {
  if (type === 'person') return { fg: colors.accent, bg: colors.accentSoft };
  if (type === 'movie') return { fg: colors.movie, bg: colors.movieSoft };
  return { fg: colors.tv, bg: colors.tvSoft };
}

export function TypeBadge({ type, compact }: Props) {
  const { fg, bg } = badgeColors(type);
  return (
    <View style={[styles.badge, compact && styles.compact, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]}>{badgeLabel(type)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  compact: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  text: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
