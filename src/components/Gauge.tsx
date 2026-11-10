import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, Text as SvgText, TSpan } from 'react-native-svg';
import { useTheme } from '../theme';

// The overall rushed-percentage dial (07 section 4, the component inventory;
// the flagship number the player screen centers on). A semicircular arc that
// fills clockwise with the deficit percentage: the track reads as the full
// ceiling, the gold arc reads as how much of it is missing, and the number
// sits in the dial's throat where the eye lands first.
//
// Built on react-native-svg, the chart library the concept stack blesses
// (01 section 1). It is a single-value instrument, not a series chart, so
// the Legend rule and the four-type chart cap do not apply to it (07
// section 5); there is nothing to legend when there is one number.
//
// The component is a display surface, not a calculation: the percentage
// arrives pre-computed from the rushed engine, clamped here only for the
// arc's own geometry. Null renders the designed "not available" reading
// (dash for the number, empty track) rather than a misleading 0.

// The dial's geometry, fixed like the prototype's: a 220x132 viewBox whose
// arc runs along a 90-radius semicircle anchored at the baseline. The dash
// length is the arc fraction; round caps give the arc its quiet ends.
const VIEW_WIDTH = 220;
const VIEW_HEIGHT = 132;
const ARC_PATH = 'M 20 120 A 90 90 0 0 1 200 120';
const ARC_LENGTH = Math.PI * 90;

// The rendered width: the dial keeps its proportions at any percentage, and
// 230 px centers comfortably in the analysis column at every breakpoint the
// two-column layout serves.
const DIAL_WIDTH = 230;

export interface GaugeProps {
  /** The percentage to draw, 0 to 100. Null renders "not available". */
  percent: number | null;
  /** The caption under the number, the reading's own scale note. */
  caption: string;
  /** What a screen reader hears for the whole dial. */
  accessibilityLabel: string;
}

export default function Gauge({ percent, caption, accessibilityLabel }: GaugeProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(), []);
  const c = theme.colors;

  const clamped = percent === null ? null : Math.min(100, Math.max(0, percent));
  const dash = clamped === null ? 0 : (clamped / 100) * ARC_LENGTH;

  return (
    <View style={styles.wrap} accessibilityLabel={accessibilityLabel} accessibilityRole="image">
      <Svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        width={DIAL_WIDTH}
        style={styles.dial}
      >
        <Path
          d={ARC_PATH}
          fill="none"
          stroke={c.panelBorderStrong}
          strokeWidth={16}
          strokeLinecap="round"
        />
        {dash > 0 ? (
          <Path
            d={ARC_PATH}
            fill="none"
            stroke={c.accent}
            strokeWidth={16}
            strokeLinecap="round"
            strokeDasharray={`${dash.toFixed(1)} ${ARC_LENGTH.toFixed(1)}`}
          />
        ) : null}
        <SvgText
          x={110}
          y={102}
          textAnchor="middle"
          fontSize={38}
          fontWeight="700"
          fill={c.textPrimary}
          fontFamily={theme.fontFamily.sans}
        >
          {clamped === null ? '\u2014' : Math.round(clamped)}
          <TSpan fontSize={19} fontWeight="600" fill={c.textMuted}>
            {'%'}
          </TSpan>
        </SvgText>
        <SvgText
          x={110}
          y={124}
          textAnchor="middle"
          fontSize={10.5}
          letterSpacing={1.6}
          fill={c.textMuted}
          fontFamily={theme.fontFamily.sans}
        >
          {caption}
        </SvgText>
      </Svg>
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    wrap: {
      alignItems: 'center',
    },
    dial: {
      maxWidth: '100%',
    },
  });
}
