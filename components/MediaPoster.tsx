import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { posterUrl } from '@/src/api/tmdb';
import { colors, radius } from '@/src/theme/colors';

interface Props {
  path: string | null | undefined;
  width?: number;
  height?: number;
  borderRadius?: number;
  placeholderIcon?: keyof typeof Ionicons.glyphMap;
}

export function MediaPoster({
  path,
  width = 110,
  height = 165,
  borderRadius = radius.md,
  placeholderIcon = 'film-outline',
}: Props) {
  const uri = posterUrl(path);
  return (
    <View style={[styles.wrap, { width, height, borderRadius }]}>
      {uri ? (
        <Image source={{ uri }} style={styles.image} contentFit="cover" transition={200} />
      ) : (
        <View style={styles.placeholder}>
          <Ionicons name={placeholderIcon} size={28} color={colors.textDim} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    backgroundColor: colors.bgSoft,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
