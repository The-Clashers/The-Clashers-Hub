import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import type { WarlogResult } from '../api/warlog';

// The war log's result pill (T-M3-2, FR-11): one chip per logged war,
// colored by the verdict from the viewed clan's side. Win reads success,
// loss reads danger, ongoing reads info blue, and two entries that carry
// no verdict — a tie, and a Clan War League season — read as the quiet
// non-verdicts they are, the same muted treatment RatioFlag's no-data
// chip keeps rather than borrowing a louder tone they have not earned.
//
// The chip is a display surface, not a calculation: the parse
// (api/warlog.ts) already narrowed the raw result field, the chip just
// reads it. Shape follows the verdict chip on the war standings card
// (pill radius, uppercase micro-label, soft fill with the strong ink
// the soft pairs guarantee contrast for).

export interface ResultChipProps {
  /** The war's outcome from the viewed clan's side. */
  result: WarlogResult;
}

const LABELS: Readonly<Record<WarlogResult, string>> = {
  win: 'Win',
  lose: 'Loss',
  tie: 'Tie',
  ongoing: 'Ongoing',
  league: 'League',
};

export default function ResultChip({ result }: ResultChipProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View
      style={[styles.chip, styles[result]]}
      accessibilityLabel={`Result: ${LABELS[result]}`}
    >
      <Text style={[styles.label, styles[`${result}Label` as const]]}>{LABELS[result]}</Text>
    </View>
  );
}

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    chip: {
      borderRadius: t.radius.pill,
      paddingHorizontal: t.spacing[2],
      paddingVertical: 2,
      minHeight: 22,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    win: {
      backgroundColor: c.successSoft,
    },
    winLabel: {
      color: c.success,
    },
    lose: {
      backgroundColor: c.dangerSoft,
    },
    loseLabel: {
      color: c.danger,
    },
    // A tie is a real outcome but no one's verdict, and a league season
    // never has one: the quiet fill, the same non-verdict treatment
    // RatioFlag's dash chip keeps.
    tie: {
      backgroundColor: c.fillQuiet,
    },
    tieLabel: {
      color: c.textMuted,
    },
    league: {
      backgroundColor: c.fillQuiet,
    },
    leagueLabel: {
      color: c.textMuted,
    },
    ongoing: {
      backgroundColor: c.infoSoft,
    },
    ongoingLabel: {
      color: c.info,
    },
    label: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.semibold,
      letterSpacing: t.letterSpacing.micro,
      textTransform: 'uppercase',
    },
  });
}
