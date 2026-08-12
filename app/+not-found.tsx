import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/src/theme/colors';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Nenalezeno' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Tato obrazovka neexistuje</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Zpět na watchlist</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.bg,
  },
  title: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 18,
    color: colors.text,
  },
  link: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
  },
  linkText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
    color: colors.accent,
  },
});
