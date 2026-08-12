import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/src/theme/colors';

interface Props {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  showSafeTop?: boolean;
}

export function ScreenHeader({ title, subtitle, right, showSafeTop = true }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, showSafeTop && { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.row}>
        <View style={styles.textCol}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 38,
    color: colors.accent,
    letterSpacing: 1.5,
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.textDim,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 6,
  },
});
