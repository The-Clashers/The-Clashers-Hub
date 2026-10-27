import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';

// A label-above-value stat pair (07 section 4). The search result cards
// render four of these per row (level, members, location, war); the clan
// and player headers reuse the same pair on their stat rows. The label
// whispers (uppercase micro), the value speaks (tabular figures, 07
// section 5), so columns of them align without decimal noise.

// Micro-label tracking: the one-off 0.6 px tracking the design language
// pairs with uppercase micro labels. It becomes a token the moment a
// second value needs one.
const LABEL_TRACKING = 0.6;

// Keeps a label+value pair from wrapping into a staircase when a long value
// (a location name) sits next to short ones in the same row.
const STAT_MIN_WIDTH = 88;

export interface StatChipProps {
  label: string;
  value: string;
}

export default function StatChip({ label, value }: StatChipProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.chip}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    chip: {
      minWidth: STAT_MIN_WIDTH,
      gap: t.spacing[1],
    },
    label: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: LABEL_TRACKING,
    },
    value: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.medium,
      color: c.textPrimary,
      fontVariant: ['tabular-nums'],
    },
  });
}
