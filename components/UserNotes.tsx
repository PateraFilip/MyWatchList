import { StyleSheet, Text, TextInput, View } from 'react-native';
import { RatingPicker } from '@/components/RatingPicker';
import type { MediaType } from '@/src/types';
import { useWatchlistStore } from '@/src/store/watchlistStore';
import { colors, radius, spacing } from '@/src/theme/colors';

interface Props {
  mediaType: MediaType;
  id: number;
}

export function UserNotes({ mediaType, id }: Props) {
  const item = useWatchlistStore((s) => s.getItem(mediaType, id));
  const setRating = useWatchlistStore((s) => s.setRating);
  const setComment = useWatchlistStore((s) => s.setComment);

  if (!item) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.hint}>
          Přidej do seznamu, abys mohl hodnotit a psát komentáře.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Tvé hodnocení</Text>
      <RatingPicker
        value={item.rating}
        onChange={(value) => setRating(mediaType, id, value)}
      />
      <Text style={styles.heading}>Komentář</Text>
      <TextInput
        style={styles.input}
        multiline
        placeholder="Co sis o tom myslel/a?"
        placeholderTextColor={colors.textDim}
        value={item.comment}
        onChangeText={(text) => setComment(mediaType, id, text)}
        textAlignVertical="top"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  heading: {
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 24,
    color: colors.text,
    letterSpacing: 0.5,
  },
  hint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  input: {
    minHeight: 100,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.text,
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
});
