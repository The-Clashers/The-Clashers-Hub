import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';

// The rushed per-category horizontal bars (07 section 4, the component
// inventory): one row per analysis category, the label left, a quiet track
// the fill climbs, and the percentage right in tabular figures. The color is
// the caller's judgment: the player screen passes each category's band color
// so a category can read "this is the neglected one" at a glance, the same
// band vocabulary the overall chip keeps.
//
// The component is a display surface, not a calculation: percentages arrive
// pre-computed, rounded only for the label. A null percentage renders the
// designed "n/a" reading (blank track, muted value) the engine's
// not-available contract asks for, never a misleading 0.

// The row's rhythm: the label column holds the longest category name
// ("Pets & Siege") on one line; the value column holds "100%" without
// squeezing the track between them.
const BAR_HEIGHT = 8;

export interface CategoryBarRow {
  /** Stable identity for the row's key (the category key). */
  key: string;
  label: string;
  /** The category's percentage, 0 to 100. Null renders "n/a". */
  percent: number | null;
  /** The fill color: the band color the caller judged for this row. */
  color: string;
}

export interface CategoryBarsProps {
  rows: ReadonlyArray<CategoryBarRow>;
}

export default function CategoryBars({ rows }: CategoryBarsProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.list} accessibilityLabel="Category bars">
      {rows.map((row) => (
        <View
          key={row.key}
          style={styles.row}
          accessibilityLabel={
            row.percent === null
              ? `${row.label}, not available`
              : `${row.label}, ${Math.round(row.percent)} percent`
          }
        >
          <Text style={styles.label} numberOfLines={1}>
            {row.label}
          </Text>
          <View
            style={[styles.track, row.percent === null ? styles.trackEmpty : null]}
            aria-hidden
          >
            {row.percent !== null && row.percent > 0 ? (
              <View
                style={[
                  styles.fill,
                  { flexBasis: `${Math.min(100, row.percent)}%`, backgroundColor: row.color },
                ]}
              />
            ) : null}
          </View>
          <Text style={row.percent === null ? styles.valueEmpty : styles.value}>
            {row.percent === null ? 'n/a' : `${Math.round(row.percent)}%`}
          </Text>
        </View>
      ))}
    </View>
  );
}

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    list: {
      gap: t.spacing[2],
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: t.spacing[3],
      minHeight: 20,
    },
    label: {
      fontFamily: t.fontFamily.sans,
      // xs, one step under the value beside it: labels whisper, values
      // speak (07 section 1). At xs even the longest category name
      // ("Pets & Siege") clears the fixed column without truncating.
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.semibold,
      color: c.textSecondary,
      flexBasis: 80,
      flexShrink: 0,
    },
    // The quiet track: the glass system's quiet fill, the same surface the
    // rails draw, so the dial's bars and the hero rails read as one family.
    track: {
      flex: 1,
      height: BAR_HEIGHT,
      borderRadius: BAR_HEIGHT / 2,
      backgroundColor: c.fillQuiet,
      borderWidth: 1,
      borderColor: c.hairline,
      overflow: 'hidden',
      flexDirection: 'row',
    },
    // The not-available reading: no track tint, just the hairline outline,
    // so an unmeasured category reads as absent rather than as zero.
    trackEmpty: {
      backgroundColor: 'transparent',
    },
    fill: {
      alignSelf: 'stretch',
      borderRadius: BAR_HEIGHT / 2,
    },
    value: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
      fontVariant: ['tabular-nums'],
      flexBasis: 44,
      flexShrink: 0,
      textAlign: 'right',
    },
    valueEmpty: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.regular,
      color: c.textMuted,
      flexBasis: 44,
      flexShrink: 0,
      textAlign: 'right',
    },
  });
}
