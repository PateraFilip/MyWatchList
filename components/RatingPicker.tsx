import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/src/theme/colors';

interface Props {
  value: number | null;
  onChange?: (value: number | null) => void;
  readonly?: boolean;
}

function clampRating(n: number) {
  return Math.min(10, Math.max(0.5, Math.round(n * 2) / 2));
}

export function RatingPicker({ value, onChange, readonly }: Props) {
  const display = value == null ? '—' : value.toFixed(1).replace(/\.0$/, '');

  const set = (next: number | null) => {
    if (!onChange || readonly) return;
    onChange(next);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.main}>
        <Pressable
          style={[styles.btn, (readonly || value == null || (value ?? 0) <= 0.5) && styles.btnDisabled]}
          disabled={readonly || !onChange}
          onPress={() => {
            if (value == null) return;
            if (value <= 0.5) set(null);
            else set(clampRating(value - 0.5));
          }}
        >
          <Ionicons name="remove" size={22} color={colors.text} />
        </Pressable>

        <View style={styles.valueBox}>
          <Text style={styles.value}>{display}</Text>
          <Text style={styles.suffix}>/ 10</Text>
        </View>

        <Pressable
          style={[styles.btn, (readonly || (value ?? 0) >= 10) && styles.btnDisabled]}
          disabled={readonly || !onChange}
          onPress={() => {
            if (value == null) set(0.5);
            else if (value < 10) set(clampRating(value + 0.5));
          }}
        >
          <Ionicons name="add" size={22} color={colors.text} />
        </Pressable>
      </View>

      {!readonly && onChange ? (
        <View style={styles.quick}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <Pressable
              key={n}
              style={[styles.quickChip, value === n && styles.quickChipActive]}
              onPress={() => set(value === n ? null : n)}
            >
              <Text style={[styles.quickText, value === n && styles.quickTextActive]}>{n}</Text>
            </Pressable>
          ))}
          {value != null ? (
            <Pressable style={styles.clear} onPress={() => set(null)}>
              <Text style={styles.clearText}>Smazat</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.hint}>Krok ±0,5 — nebo klepni na celé číslo</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  main: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  btn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  valueBox: {
    flex: 1,
    minHeight: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  value: {
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 40,
    color: colors.accent,
    letterSpacing: 1,
  },
  suffix: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 16,
    color: colors.textDim,
    marginTop: 8,
  },
  quick: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  quickChip: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickChipActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  quickText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13,
    color: colors.textMuted,
  },
  quickTextActive: {
    color: colors.accent,
  },
  clear: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  clearText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    color: colors.danger,
  },
  hint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textDim,
  },
});
