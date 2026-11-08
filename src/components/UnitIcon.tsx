import { useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { iconForUnit, PLACEHOLDER_ICON } from '../lib/unit-icons';

// The unit icon tile (07 section 4 "UnitIcon"). A bundled game icon in a
// fixed 32 px slot (07 section 7 "Imagery"): resolved through the typed
// icon map with the placeholder fallback, never a hotlink to a third-party
// CDN, never a wrong icon standing in for a missing one.
//
// The slot is fixed so a slow icon load (a large PNG, a cold bundle parse)
// never reflows the grid: the tile reserves its 32 px box and the icon
// paints into it when it arrives. The placeholder is the same size, so a
// unit without a bundled icon renders the same box, not a broken image.
//
// The component owns its styles (STD-13): callers pass a unit name, never
// a stylesheet. The accessibility label is the unit name plus "icon" so a
// screen reader hears what the tile represents.

/** The fixed icon slot (07 section 7). Kept as a named constant so the
 * grid's column math can reference it without a magic number (STD-21). */
export const UNIT_ICON_SIZE = 32;

export interface UnitIconProps {
  /** The unit name as it appears in the player payload. Resolved through
   * the icon map; an unknown name renders the placeholder. */
  name: string;
}

export default function UnitIcon({ name }: UnitIconProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const uri = iconForUnit(name);
  const isPlaceholder = uri === PLACEHOLDER_ICON;

  if (isPlaceholder) {
    // The placeholder is an SVG; react-native-web renders it as an <img>,
    // and the fixed slot keeps the layout stable while it loads.
    return (
      <View style={styles.slot} accessibilityLabel={`${name} icon`} accessibilityRole="image">
        <Image source={{ uri }} style={styles.icon} />
      </View>
    );
  }

  return (
    <View style={styles.slot} accessibilityLabel={`${name} icon`} accessibilityRole="image">
      <Image source={{ uri }} style={styles.icon} />
    </View>
  );
}

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    slot: {
      width: UNIT_ICON_SIZE,
      height: UNIT_ICON_SIZE,
      borderRadius: t.radius[1],
      backgroundColor: t.colors.panel,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    icon: {
      width: UNIT_ICON_SIZE,
      height: UNIT_ICON_SIZE,
    },
  });
}
