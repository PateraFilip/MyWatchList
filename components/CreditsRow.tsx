import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { profileUrl } from '@/src/api/tmdb';
import type { PersonRef } from '@/src/types';
import { colors, radius, spacing } from '@/src/theme/colors';

interface Props {
  title: string;
  people: PersonRef[];
}

export function CreditsRow({ title, people }: Props) {
  if (!people.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
          {people.map((person) => {
            const uri = profileUrl(person.profilePath);
            return (
              <Pressable
                key={`${person.id}-${person.job || person.character || 'p'}`}
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
                onPress={() =>
                  router.push({
                    pathname: '/person/[id]',
                    params: { id: String(person.id) },
                  })
                }
              >
                <View style={styles.avatar}>
                  {uri ? (
                    <Image source={{ uri }} style={styles.image} contentFit="cover" />
                  ) : (
                    <Ionicons name="person" size={28} color={colors.textDim} />
                  )}
                </View>
                <Text style={styles.name} numberOfLines={2}>
                  {person.name}
                </Text>
                <Text style={styles.role} numberOfLines={2}>
                  {person.character || person.job || ' '}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  heading: {
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 26,
    color: colors.text,
    letterSpacing: 0.5,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: 4,
  },
  card: {
    width: 96,
    gap: 4,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  name: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 12,
    color: colors.text,
    lineHeight: 16,
  },
  role: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: colors.textDim,
    lineHeight: 14,
  },
});
