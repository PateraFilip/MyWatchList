import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ListStatus, MediaType, WatchItemSource } from '@/src/types';
import { useWatchlistStore } from '@/src/store/watchlistStore';
import { colors, radius, spacing } from '@/src/theme/colors';

interface Props {
  mediaType: MediaType;
  id: number;
  title: string;
  source: WatchItemSource;
}

export function ListActions({ mediaType, id, title, source }: Props) {
  const item = useWatchlistStore((s) => s.getItem(mediaType, id));
  const addItem = useWatchlistStore((s) => s.addItem);
  const setStatus = useWatchlistStore((s) => s.setStatus);
  const removeItem = useWatchlistStore((s) => s.removeItem);

  const set = (status: ListStatus) => {
    if (item) setStatus(mediaType, id, status);
    else addItem(source, mediaType, status);
  };

  const onRemove = () => {
    Alert.alert('Odebrat ze seznamu', `Odebrat „${title}" ze seznamu?`, [
      { text: 'Zrušit', style: 'cancel' },
      {
        text: 'Odebrat',
        style: 'destructive',
        onPress: () => removeItem(mediaType, id),
      },
    ]);
  };

  return (
    <View style={styles.row}>
      <Pressable
        style={[
          styles.btn,
          item?.status === 'watchlist' && styles.btnAccent,
        ]}
        onPress={() => set('watchlist')}
      >
        <Ionicons
          name={item?.status === 'watchlist' ? 'bookmark' : 'bookmark-outline'}
          size={18}
          color={item?.status === 'watchlist' ? colors.bg : colors.accent}
        />
        <Text
          style={[
            styles.btnText,
            item?.status === 'watchlist' && styles.btnTextActive,
          ]}
        >
          Ke zhlédnutí
        </Text>
      </Pressable>

      <Pressable
        style={[
          styles.btn,
          item?.status === 'watched' && styles.btnSuccess,
        ]}
        onPress={() => set('watched')}
      >
        <Ionicons
          name={item?.status === 'watched' ? 'checkmark-circle' : 'checkmark-circle-outline'}
          size={18}
          color={item?.status === 'watched' ? colors.bg : colors.success}
        />
        <Text
          style={[
            styles.btnText,
            { color: colors.success },
            item?.status === 'watched' && styles.btnTextActive,
          ]}
        >
          Zhlédnuto
        </Text>
      </Pressable>

      {item ? (
        <Pressable style={styles.removeBtn} onPress={onRemove}>
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnAccent: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  btnSuccess: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  btnText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13,
    color: colors.accent,
  },
  btnTextActive: {
    color: colors.bg,
  },
  removeBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerSoft,
  },
});
