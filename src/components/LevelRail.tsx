import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';

// The level rail (07 section 4, the component inventory). One hero row's
// rail in the hero panel (T-M2-4, FR-09): a quiet track that fills with
// the level/maximum fraction. No star markers — stars are the
// achievements' judgment (ProgressRail owns them); a hero's level has no
// in-game thresholds to earn, the fill is the whole story.
//
// The rail is a display surface, not a calculation: the fill is
// pre-computed by lib/hero-progress.ts, so this render is a lookup and
// the rules are testable without React (STD-09), the same split
// ProgressRail keeps. The track and fill mirror ProgressRail's sizes so
// the two rails read as one family: same 6 px bar, same panel-tone track
// with a hairline border, same gold fill (gold is reserved for the
// verdicts, 07 section 2).
//
// Accessibility: the rail exposes one label ("Level rail 79 percent");
// the hero row's own label carries the name and the level/maximum pair,
// so a screen reader hears both, never twice.

// The rail's height: the same 6 px track ProgressRail draws, so the two
// rail families never read as different weights beside each other.
const RAIL_HEIGHT = 6;

// Fully round ends, the same cap ProgressRail takes.
const RAIL_RADIUS = RAIL_HEIGHT / 2;

export interface LevelRailProps {
  /** The pre-computed fill, 0 to 1, from lib/hero-progress.ts. */
  fill: number;
}

export default function LevelRail({ fill }: LevelRailProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const percent = Math.round(Math.min(1, Math.max(0, fill)) * 100);

  return (
    <View
      style={styles.track}
      accessibilityLabel={`Level rail ${percent} percent`}
    >
      <View style={[styles.fill, { flexBasis: `${percent}%` }]} aria-hidden />
    </View>
  );
}

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    // The quiet track the fill climbs: the glass system's quiet fill with a
    // hairline border, so an empty rail still reads as a rail on the
    // translucent panel behind it (panel tone itself is now glass and
    // would vanish into its host).
    track: {
      height: RAIL_HEIGHT,
      borderRadius: RAIL_RADIUS,
      backgroundColor: c.fillQuiet,
      borderWidth: 1,
      borderColor: c.hairline,
      // Clip the fill to the track's rounded ends.
      overflow: 'hidden',
      flexDirection: 'row',
    },
    // The fill takes the gold accent: it is the row's verdict-in-motion,
    // the same reserve the achievements rail draws from.
    fill: {
      alignSelf: 'stretch',
      backgroundColor: c.accent,
      borderRadius: RAIL_RADIUS,
    },
  });
}
