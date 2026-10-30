import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet } from 'react-native';
import { useTheme, type RadiusStep } from '../theme';

// The skeleton atom (06 section 3, 07 section 4): one quiet hairline block
// that pulses. Every skeleton shape in the product composes these, so the
// block's look (hairline fill, small radius) is owned here once (STD-22)
// and a screen only decides sizes. The pulse value comes from
// {@link useSkeletonPulse}: a surface calls the hook once and hands the
// same value to every block it renders, so one skeleton costs exactly one
// animation loop no matter how many blocks it holds, and the whole shape
// breathes in unison.
//
// The pulse is the one ambient motion the design language allows (the
// `pulse` motion token), and it is disabled entirely when the visitor asks
// for reduced motion: the blocks hold still, which stays a legible loading
// state because the layout itself is the signal, never a spinner.

// How far the opacity dips on each cycle. Enough to read as breathing,
// not enough to flash; hairline blocks on a panel stay visible through
// the whole cycle.
const PULSE_MIN_OPACITY = 0.55;

// A block width can also be a percentage of its container, the way a
// full-width description line is.
export type SkeletonWidth = number | `${number}%`;

function useReducedMotionPreference(): boolean {
  // Defaults to false: until the preference resolves the skeleton animates,
  // and a visitor with reduce-motion sees at most one cycle before it
  // settles. Where the platform cannot answer, the safe default is no
  // motion at all.
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setReduced(enabled);
      })
      .catch(() => {
        // Cannot know: keep the still skeleton.
        if (active) setReduced(true);
      });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReduced(enabled);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}

/**
 * The shared pulse behind a skeleton surface. Call once per surface and
 * pass the returned value to every {@link SkeletonBlock} it renders; the
 * blocks then animate together on a single loop, which stops while the
 * visitor prefers reduced motion.
 */
export function useSkeletonPulse(): Animated.Value {
  const { theme } = useTheme();
  const reducedMotion = useReducedMotionPreference();
  // useRef, not useState: the Animated.Value is a mutable animation handle
  // the loop drives; re-rendering on its changes would defeat the point.
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(1);
      return;
    }
    const halfCycle = theme.motion.pulse / 2;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: PULSE_MIN_OPACITY,
          duration: halfCycle,
          easing: Easing.inOut(Easing.quad),
          // JS-driven on web: RN Web has no native animated driver, and a
          // loading state is exactly where a cheap rAF loop is fine.
          useNativeDriver: false,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: halfCycle,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      opacity.setValue(1);
    };
  }, [opacity, reducedMotion, theme.motion.pulse]);

  return opacity;
}

export interface SkeletonBlockProps {
  /** The block's width; a percentage string stretches with the container. */
  width: SkeletonWidth;
  /** The block's height, usually the font size of the line it stands in for. */
  height: number;
  /** The shared pulse from {@link useSkeletonPulse}. */
  pulse: Animated.Value;
  /** Which radius step the block rounds with; defaults to the small chip
   * radius, the one skeleton lines use. */
  radiusStep?: RadiusStep;
}

export default function SkeletonBlock({ width, height, pulse, radiusStep = 1 }: SkeletonBlockProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme, radiusStep), [theme, radiusStep]);
  // aria-hidden: the blocks are pure decoration; the surface they belong to
  // carries the progressbar role and label a screen reader should hear.
  return <Animated.View style={[styles.block, { width, height, opacity: pulse }]} aria-hidden />;
}

function createStyles(t: ReturnType<typeof useTheme>['theme'], radiusStep: RadiusStep) {
  const c = t.colors;
  return StyleSheet.create({
    block: {
      backgroundColor: c.hairline,
      borderRadius: t.radius[radiusStep],
    },
  });
}
