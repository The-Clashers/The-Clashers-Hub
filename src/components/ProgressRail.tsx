import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import type { AchievementProgress } from '../lib/achievement-progress';

// The progress rail (07 section 4: "ProgressRail, achievement value/target
// bar with star markers"). One achievement row's rail: a quiet track that
// fills with the value/target fraction, with the star slots beside it so
// the reader sees both judgments at once — how far the counter has climbed,
// and how many stars that climb has already earned.
//
// The rail is a display surface, not a calculation: the fill, the star
// slots, and the completed flag are pre-computed by
// lib/achievement-progress.ts, so this render is a lookup and the rules are
// testable without React (STD-09), the same split RatioFlag keeps.
//
// Stars are the API's truth, never derived from the fill (a player can hold
// 2 stars a quarter of the way to the target, or 1 star past it). The
// earned slots take the gold accent — stars are the verdict, and gold is
// reserved for the things that matter (07 section 2). The open slots stay
// quiet so an in-progress row reads as two earned and one to go, not as
// three competing marks. A completed row renders no open slot at all: all
// three in reads cleaner than a full rail with nothing waiting beside it.

// The earned star glyph. A text glyph rather than an SVG shape: the kit has
// no chart dependency yet, the glyph renders at the same size in both
// themes, and the star is a rating mark, not a data point, so the
// no-chart-junk rule is not engaged.
const STAR_GLYPH = '\u2605';

// The open star glyph. The outline star keeps the slot's width so a row
// that earns its last star does not shift the rail's layout.
const OPEN_STAR_GLYPH = '\u2606';

// The rail's height: a 6 px track reads as a bar, not a line, at the body
// font size the row sets beside it.
const RAIL_HEIGHT = 6;

// The corner a rail takes: fully round, so the fill's end is a cap and the
// track's ends never read as square corners on a rounded panel.
const RAIL_RADIUS = RAIL_HEIGHT / 2;

// The star row's size: 14 px sits between the caption and body sizes, big
// enough to read as a glyph, small enough to stay a mark beside the numbers.
const STAR_SIZE = 14;

// The gap between the star glyphs: tight enough to read as one rating, wide
// enough that the outline stars do not touch at 14 px.
const STAR_GAP = 2;

export interface ProgressRailProps {
  /** The pre-computed display data for the row, from
   * lib/achievement-progress.ts. */
  progress: AchievementProgress;
}

export default function ProgressRail({ progress }: ProgressRailProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View
      style={styles.row}
      accessibilityLabel={railAccessibilityLabel(progress)}
    >
      <View style={styles.track} aria-hidden>
        <View
          style={[styles.fill, { flexBasis: `${Math.round(progress.fill * 100)}%` }]}
        />
      </View>
      <View style={styles.stars} aria-hidden>
        {Array.from({ length: progress.stars.total }, (_, index) => {
          const isEarned = index < progress.stars.earned;
          return (
            <Text
              key={index}
              style={isEarned ? styles.starEarned : styles.starOpen}
            >
              {isEarned ? STAR_GLYPH : OPEN_STAR_GLYPH}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

/** What a screen reader hears for the rail: the fill as a percentage and
 * the stars as a count. The value/target pair and the requirement text are
 * the row's own labels; this one covers only the rail's two judgments. */
function railAccessibilityLabel(progress: AchievementProgress): string {
  const percent = Math.round(progress.fill * 100);
  const { earned, total } = progress.stars;
  return `Progress rail ${percent} percent, ${earned} of ${total} stars`;
}

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: t.spacing[3],
    },
    // The quiet track the fill climbs: the glass system's quiet fill with a
    // hairline border, so an empty rail still reads as a rail on the
    // translucent panel behind it (panel tone itself is now glass and
    // would vanish into its host).
    track: {
      flex: 1,
      height: RAIL_HEIGHT,
      borderRadius: RAIL_RADIUS,
      backgroundColor: c.fillQuiet,
      borderWidth: 1,
      borderColor: c.hairline,
      // Clip the fill to the track's rounded ends.
      overflow: 'hidden',
      flexDirection: 'row',
    },
    // The fill takes the gold accent: it is the row's verdict-in-motion, the
    // same reserve the numbers and focus ring draw from.
    fill: {
      alignSelf: 'stretch',
      backgroundColor: c.accent,
      borderRadius: RAIL_RADIUS,
    },
    stars: {
      flexDirection: 'row',
      columnGap: STAR_GAP,
      alignItems: 'center',
    },
    starEarned: {
      color: c.accent,
      fontSize: STAR_SIZE,
      lineHeight: STAR_SIZE,
    },
    starOpen: {
      color: c.panelBorderStrong,
      fontSize: STAR_SIZE,
      lineHeight: STAR_SIZE,
    },
  });
}
