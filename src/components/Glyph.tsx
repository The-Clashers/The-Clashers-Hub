import { useMemo } from 'react';
import Svg, { Path } from 'react-native-svg';

// The UI glyph set (07 section 4, the component inventory): the small
// stroke marks the owner's prototype drew for its buttons and links —
// compare, refresh, home—rendered here on react-native-svg, the chart
// library the stack already blesses (the same dependency `Gauge` and
// `GlassAmbience` ride). Until now every piece of kit chrome was text;
// the prototype's buttons carry their glyphs, so the kit needs one
// component that draws them.
//
// The paths are the prototype's own, verbatim: same 0 0 24 24 viewBox,
// same 1.8 stroke, same round caps and joins. Color is a prop, not
// currentColor: RN has no inherited text color for SVG children, so each
// caller hands in the theme color its context reads (the button's
// on-accent ink, the link's active or resting ink).
//
// The star is the one filled glyph: it is a rating mark, the same role
// the achievements card's star slots play, so it fills with its color the
// way the prototype's starFill does.
//
// Accessibility: glyphs are decorative by design. Every surface that
// renders one already labels itself with text (the button's label, the
// link's label), so the picture adds nothing a screen reader needs.

/** The glyph's default size: the 16 px box the prototype's icons render
 * in, matching the body-size text they sit beside. */
const GLYPH_SIZE = 16;

/** The star's own default: 13 px, the size the prototype's star ratings
 * render at, sitting between the caption and body text sizes. */
const STAR_SIZE = 13;

/** The stroke weight every stroke glyph draws with, the prototype's
 * value. */
const GLYPH_STROKE_WIDTH = 1.8;

/** The one filled glyph's stroke: slightly heavier than the stroke
 * glyphs' so the star's points stay crisp at 13 px. */
const STAR_STROKE_WIDTH = 1.5;

export type GlyphName = 'compare' | 'refresh' | 'home' | 'star';

/** Each glyph's subpaths, straight from the prototype's ICO set. */
const GLYPH_PATHS: Record<GlyphName, ReadonlyArray<string>> = {
  // The compare mark: two columns with their opposing chevrons.
  compare: ['M8 3v18M16 3v18', 'M4 7l4-4 4 4M12 17l4 4 4-4'],
  // The refresh mark: an open circle with the arrowhead breaking out.
  refresh: ['M21 12a9 9 0 1 1-2.6-6.3', 'M21 3v6h-6'],
  // The home mark: a roofline over an open door.
  home: ['M3 10.5 12 3l9 7.5', 'M5 9.5V21h14V9.5'],
  // The star mark: the rating glyph, filled.
  star: ['M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z'],
};

export interface GlyphProps {
  /** Which glyph to draw. */
  name: GlyphName;
  /** The glyph's box size in px; 16 by default, 13 for the star's own
   * default. */
  size?: number;
  /** The glyph's color: the theme color the surrounding context reads. */
  color: string;
}

export default function Glyph({ name, size, color }: GlyphProps) {
  const isStar = name === 'star';
  const box = size ?? (isStar ? STAR_SIZE : GLYPH_SIZE);
  const styles = useMemo(() => createStyles(), []);

  return (
    <Svg
      viewBox="0 0 24 24"
      width={box}
      height={box}
      style={styles.glyph}
      aria-hidden
    >
      {GLYPH_PATHS[name].map((d) => (
        <Path
          key={d}
          d={d}
          fill={isStar ? color : 'none'}
          stroke={color}
          strokeWidth={isStar ? STAR_STROKE_WIDTH : GLYPH_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}

function createStyles() {
  // The glyph's only style: it never flexes or shrinks inside a button
  // row (the prototype's `.btn svg { flex: none; }`), so a long label
  // can never crush the mark.
  return { glyph: { flexShrink: 0 } };
}
