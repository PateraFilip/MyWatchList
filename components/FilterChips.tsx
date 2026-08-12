import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing } from '@/src/theme/colors';

export type MediaFilter = 'all' | 'movie' | 'tv';

interface Props {
  value: MediaFilter;
  onChange: (value: MediaFilter) => void;
}

const OPTIONS: { value: MediaFilter; label: string }[] = [
  { value: 'all', label: 'Vše' },
  { value: 'movie', label: 'Filmy' },
  { value: 'tv', label: 'Seriály' },
];

export function FilterChips({ value, onChange }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  label: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.accent,
  },
});
