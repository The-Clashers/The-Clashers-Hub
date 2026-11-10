import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../theme';

// The ambience layer (07 section 1 "Feel", the glass pass): the canvas's two
// soft glow fields, drawn once behind every screen. The gold wash (glowA)
// sits over the canvas's upper field, the cool wash (glowB) over its lower
// one; the panels blur whatever part of them passes behind, which is what
// makes the glass read as lit rather than as fogged white.
//
// It is fixed to the viewport and pointer-transparent, so it never scrolls,
// never intercepts a tap, and never asks the document for repaints: the
// gradients are baked into one SVG the browser composites. The layer renders
// before the nav bar and the routes, so every real surface paints above it
// in stacking order without anyone declaring a z-index.
//
// Radial gradients are the one thing Views cannot draw (a plain View is a
// rectangle with a hard edge), which is why this layer uses react-native-svg
// — the same chart library the concept stack already blesses (01 section 1).
// The layer is decorative: aria-hidden, no focus, no role.

export default function GlassAmbience() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(), []);
  const c = theme.colors;

  return (
    <View style={styles.field} aria-hidden>
      <Svg width="100%" height="100%" preserveAspectRatio="none" style={styles.svg}>
        <Defs>
          <RadialGradient id="tchGlowA" cx="12%" cy="0%" r="55%">
            <Stop offset="0%" stopColor={c.glowA} stopOpacity={1} />
            <Stop offset="100%" stopColor={c.glowA} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="tchGlowB" cx="92%" cy="100%" r="60%">
            <Stop offset="0%" stopColor={c.glowB} stopOpacity={1} />
            <Stop offset="100%" stopColor={c.glowB} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#tchGlowA)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#tchGlowB)" />
      </Svg>
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    // Fixed to the viewport, full bleed, behind everything: the first child
    // of the app root. position:fixed is the same react-native-web runtime
    // cast the NavBar's bar and the Dropdown's listbox record.
    field: {
      position: 'fixed' as unknown as 'relative',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      pointerEvents: 'none',
    },
    svg: {
      flex: 1,
    },
  });
}
