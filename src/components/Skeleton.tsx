import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';

// The card-shaped skeleton (06 section 3, 07 section 4): the loading state
// is the card's own shape pulsing quietly. No spinner; the layout is the
// signal. It mirrors ClanCard's chrome on purpose, so the swap from
// skeleton to data does not reflow; if the card's layout changes, this
// follows in the same PR.

// Widths mimic a typical card's name line and stat line; the heights match
// the font sizes those rows render at.
const NAME_LINE_WIDTH = 200;
const STATS_LINE_WIDTH = 280;

// The same fixed badge slot the card renders its API icon into.
const BADGE_SLOT = 48;

export default function SkeletonCard() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.card}>
      <View style={styles.badge} />
      <View style={styles.body}>
        <View style={[styles.line, styles.nameLine]} />
        <View style={[styles.line, styles.statsLine]} />
      </View>
    </View>
  );
}

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing[4],
      padding: t.spacing[4],
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorder,
      backgroundColor: c.panelRaised,
    },
    badge: {
      width: BADGE_SLOT,
      height: BADGE_SLOT,
      borderRadius: t.radius[2],
      backgroundColor: c.hairline,
    },
    body: {
      flex: 1,
      gap: t.spacing[2],
    },
    line: {
      backgroundColor: c.hairline,
      borderRadius: t.radius[1],
    },
    nameLine: {
      height: t.fontSize.md,
      width: NAME_LINE_WIDTH,
    },
    statsLine: {
      height: t.fontSize.sm,
      width: STATS_LINE_WIDTH,
      marginTop: t.spacing[2],
    },
  });
}
