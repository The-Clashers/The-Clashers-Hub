import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import {
  formatRecord,
  formatStarsPerAttack,
  formatWinRate,
  type WarEfficiencySummary,
} from '../lib/war-efficiency';
import { formatWarPercent } from '../lib/war-standings';

// The war log's efficiency summary band (T-M3-2, FR-12, the "efficiency
// summary" piece of the Log tab design): the engine doc's own three
// metrics — win rate, stars per attack, average destruction — plus the
// record line, over the loaded page of wars with the sample size
// labeled ("last 10 wars") so nobody over-reads a short window (05
// section 3). The engine (lib/war-efficiency.ts) computes everything;
// this band is the display surface.
//
// Every rate the engine cannot answer renders the quiet dash, never a
// zero: an all-ongoing page has no win rate yet, and a page with no
// attacks has no per-attack figures. The metric cells are the uniform
// label-above-value cells the clan detail card's stat grid established,
// tabular figures so the columns align; the cells wrap, two-up on the
// narrow viewports the stat grid keeps.

export interface WarlogSummaryProps {
  /** The engine's aggregate over the loaded page of wars. */
  summary: WarEfficiencySummary;
}

export default function WarlogSummary({ summary }: WarlogSummaryProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const sample =
    summary.wars === 1 ? 'Last 1 war' : `Last ${summary.wars} wars`;
  // League seasons render as log rows but join no rate; the caption
  // says so, the sample-size honesty the engine doc demands (05
  // section 3), so nobody wonders why the counts and the rows differ.
  const caption =
    summary.leagues > 0 ? `${sample} \u00b7 excluding ${summary.leagues} league${summary.leagues === 1 ? '' : 's'}` : sample;
  const accessibilityParts = [
    `War efficiency over the last ${summary.wars} wars`,
    summary.winRate !== null ? `win rate ${formatWinRate(summary.winRate)}` : 'no decided wars yet',
    summary.starsPerAttack !== null
      ? `${formatStarsPerAttack(summary.starsPerAttack)} stars per attack`
      : 'no attacks recorded',
    summary.averageDestruction !== null
      ? `${formatWarPercent(summary.averageDestruction)} average destruction`
      : 'no destruction recorded',
    formatRecord(summary),
    ...(summary.leagues > 0 ? [`${summary.leagues} league seasons set apart`] : []),
  ];

  return (
    <View style={styles.panel} accessibilityLabel={accessibilityParts.join(', ')}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>War efficiency</Text>
        <Text style={styles.sample}>{caption}</Text>
      </View>
      <View style={styles.metricRow}>
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>Win rate</Text>
          <Text style={summary.winRate !== null ? styles.metricValue : styles.metricDash}>
            {summary.winRate !== null ? formatWinRate(summary.winRate) : '\u2014'}
          </Text>
        </View>
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>Stars per attack</Text>
          <Text style={summary.starsPerAttack !== null ? styles.metricValue : styles.metricDash}>
            {summary.starsPerAttack !== null
              ? formatStarsPerAttack(summary.starsPerAttack)
              : '\u2014'}
          </Text>
        </View>
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>Avg destruction</Text>
          <Text
            style={summary.averageDestruction !== null ? styles.metricValue : styles.metricDash}
          >
            {summary.averageDestruction !== null
              ? formatWarPercent(summary.averageDestruction)
              : '\u2014'}
          </Text>
        </View>
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>Record</Text>
          <Text style={styles.metricValue}>{formatRecord(summary)}</Text>
        </View>
      </View>
    </View>
  );
}

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    // The same card chrome the war standings cards and the tables keep:
    // translucent raised fill, glass top edge, no backdrop blur.
    panel: {
      padding: t.spacing[3],
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorder,
      borderTopColor: c.panelHighlight,
      backgroundColor: c.panelRaised,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      columnGap: t.spacing[2],
      rowGap: t.spacing[1],
    },
    title: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.md,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
    },
    sample: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      color: c.textMuted,
    },
    // The uniform label-above-value cells, the stat grid's own shape;
    // tabular figures keep the values comparable at a glance.
    metricRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: t.spacing[5],
      rowGap: t.spacing[2],
      marginTop: t.spacing[3],
    },
    metricCell: {
      gap: t.spacing[1],
    },
    metricLabel: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: t.letterSpacing.micro,
    },
    metricValue: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize['2xl'],
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    metricDash: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize['2xl'],
      fontWeight: t.fontWeight.semibold,
      color: c.textMuted,
      fontVariant: ['tabular-nums'],
    },
  });
}
