import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import type { DonationState, DonationVerdict } from '../lib/donation-balance';

// The donation-balance chip (07 section 4: "RatioFlag, donation-balance chip
// (good/warn/dash states)"). Renders one member's donation ratio as a
// compact pill whose color carries the verdict: good (at or above target)
// is the success token, warn (below target, above the noise floor) is the
// warning token, and dash (no data, both counters zero) is a muted dash.
//
// The chip is a display surface, not a calculation: the engine
// (lib/donation-balance.ts) pre-computes the verdict, the chip just reads
// it. That keeps the render a lookup and the rule testable without React
// (STD-09).
//
// The chip shows the RATIO as "ratio : 1" (05 section 2), not the raw
// given/received counters: those already have their own roster columns
// (Donations, Received), so repeating them here would make the row say the
// same thing twice. One decimal at most, tabular figures so a column of
// chips aligns. The accessibility label still reads the counters and the
// verdict, so a screen reader hears the whole judgment. The component owns
// its styles (STD-13): callers pass a verdict, never a stylesheet.

export interface RatioFlagProps {
  /** The member's donation verdict from the balance engine. */
  verdict: DonationVerdict;
}

export default function RatioFlag({ verdict }: RatioFlagProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const tone = stylesByState(verdict.state, styles);

  return (
    <View style={[styles.chip, tone.chip]} accessibilityLabel={accessibilityLabel(verdict)}>
      <Text style={[styles.text, tone.text]} numberOfLines={1}>
        {verdict.state === 'dash' ? '\u2014' : formatRatio(verdict)}
      </Text>
    </View>
  );
}

/** The on-screen string for the ratio: "ratio : 1" (05 section 2). A
 * saint (received = 0, given > 0) has no finite ratio, so it reads as the
 * infinity it is; both zero is the dash state, handled by the caller. */
function formatRatio(verdict: DonationVerdict): string {
  if (verdict.received === 0) {
    return '\u221E : 1';
  }
  return `${formatRatioNumber(verdict.given / verdict.received)} : 1`;
}

/** One decimal at most, trailing ".0" dropped: 1 -> "1", 1.2 -> "1.2",
 * 0.4 -> "0.4". The ratio is inherently fractional, which is the one case
 * the design language allows a decimal (07 section 5). */
function formatRatioNumber(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '');
}

function accessibilityLabel(verdict: DonationVerdict): string {
  if (verdict.state === 'dash') {
    return 'Donations: no data yet this season';
  }
  const verdictWord = verdict.flagged ? 'below target' : 'at or above target';
  return `Donations ${verdict.given} given, ${verdict.received} received, ${verdictWord}`;
}

interface ToneStyles {
  chip: { backgroundColor: string; borderColor: string };
  text: { color: string };
}

function stylesByState(state: DonationState, styles: ReturnType<typeof createStyles>): ToneStyles {
  switch (state) {
    case 'good':
      return { chip: styles.chipGood, text: styles.textGood };
    case 'warn':
      return { chip: styles.chipWarn, text: styles.textWarn };
    case 'dash':
      return { chip: styles.chipDash, text: styles.textDash };
  }
}

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: t.spacing[3],
      paddingVertical: t.spacing[1],
      borderRadius: t.radius.pill,
      borderWidth: 1,
      minHeight: 24,
    },
    // good: success token, the member is pulling their weight
    chipGood: {
      backgroundColor: c.successSoft,
      borderColor: c.success,
    },
    textGood: {
      color: c.success,
    },
    // warn: warning token, the member is below the donation target
    chipWarn: {
      backgroundColor: c.warningSoft,
      borderColor: c.warning,
    },
    textWarn: {
      color: c.warning,
    },
    // dash: no data, a muted chip that does not read as a verdict
    chipDash: {
      backgroundColor: c.panel,
      borderColor: c.panelBorder,
    },
    textDash: {
      color: c.textMuted,
    },
    text: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.semibold,
      fontVariant: ['tabular-nums'],
    },
  });
}
