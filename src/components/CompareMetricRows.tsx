import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createBaseStyles, useTheme } from '../theme';
import type { CompareGroup, CompareRow } from '../engines/compare';

// The compare view's metric rows (T-M3-3, FR-13): one row per metric in
// the union of both profiles, each carrying both values, the delta, and
// the direction color (better/worse, 05 section 4). The engine owns the
// verdict; this component only renders it (STD-09).
//
// Row shape: A's value | the metric label with the delta under it | B's
// value, the two values mirroring around the center so the composition
// reads as a face-off at every width the content column keeps (the
// 360 px floor included: the value cells take fixed modest bases, the
// label flexes).
//
// Direction coloring per metric (the subtask's own words): the leading
// value speaks in the success ink, the trailing value in the danger ink,
// an exact tie keeps both in primary ink, and a metric one side cannot
// answer keeps both quiet with the dash, never a fake verdict. The
// delta rides under the label in the leader's own color: one number,
// one meaning, the margin the leader leads by ("+12" green whoever
// leads, "Even" quiet on a tie), unsigned because the sign would
// compete with the value colors on lower-is-better metrics where a
// bigger number is a worse side.
//
// The deliberate limitation is visible in the component's own shape:
// there is no winner row, no aggregate, no overall banner to render
// (05 section 4), only these per-metric verdicts.

/** The fixed basis each value column takes; the label column flexes
 * between them. */
const VALUE_BASIS = 84;

export interface CompareMetricRowsProps {
  /** The engine's groups, in display order. */
  groups: readonly CompareGroup[];
  /** The two players' names, read by each row's accessibility label. */
  aName: string;
  bName: string;
}

export default function CompareMetricRows({ groups, aName, bName }: CompareMetricRowsProps) {
  const { theme } = useTheme();

  return (
    <View style={useMemo(() => createLayout(theme), [theme]).column} accessibilityRole="grid">
      {groups.map((group) => (
        <CompareGroupPanel key={group.id} group={group} aName={aName} bName={bName} />
      ))}
    </View>
  );
}

// ---------- one group panel ----------

interface CompareGroupPanelProps {
  group: CompareGroup;
  aName: string;
  bName: string;
}

function CompareGroupPanel({ group, aName, bName }: CompareGroupPanelProps) {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (group.rows.length === 0) return null;

  return (
    <View
      style={[base.panel, styles.groupPanel]}
      accessibilityRole="grid"
      accessibilityLabel={group.label}
    >
      <View style={styles.groupHeader}>
        <Text style={styles.groupHeaderLabel}>{group.label}</Text>
      </View>
      {group.rows.map((row) => (
        <CompareRowView key={row.id} row={row} aName={aName} bName={bName} styles={styles} />
      ))}
    </View>
  );
}

// ---------- one row ----------

interface CompareRowViewProps {
  row: CompareRow;
  aName: string;
  bName: string;
  styles: ReturnType<typeof createStyles>;
}

function CompareRowView({ row, aName, bName, styles }: CompareRowViewProps) {
  const { theme } = useTheme();

  // The row's verdict read as words: who leads, an exact tie, or a
  // metric one side cannot answer (the dash keeps its honesty).
  const verdictText =
    row.direction === 'a'
      ? `${aName} ahead`
      : row.direction === 'b'
        ? `${bName} ahead`
        : row.direction === 'even'
          ? 'even'
          : 'not comparable';

  return (
    <View
      accessibilityRole="row"
      accessibilityLabel={`${row.label}: ${aName} ${row.aDisplay}, ${bName} ${row.bDisplay}. ${verdictText}.`}
      style={styles.row}
    >
      <View style={styles.valueCellA}>
        <Text style={[styles.valueText, valueInk(theme, row.direction, 'a')]}>
          {row.aDisplay}
        </Text>
      </View>
      <View style={styles.labelCell}>
        <Text style={styles.labelText} numberOfLines={1}>
          {row.label}
        </Text>
        {row.direction !== 'none' ? (
          <Text
            style={[
              styles.deltaText,
              row.direction === 'even' ? styles.deltaEven : styles.deltaLeading,
            ]}
          >
            {row.deltaDisplay}
          </Text>
        ) : null}
      </View>
      <View style={styles.valueCellB}>
        <Text style={[styles.valueText, valueInk(theme, row.direction, 'b')]}>
          {row.bDisplay}
        </Text>
      </View>
    </View>
  );
}

/** One value cell's ink: the leader speaks in success, the trailer in
 * danger, a tie in primary, an incomparable metric in secondary (both
 * values real, no verdict to color them by). */
function valueInk(
  theme: ReturnType<typeof useTheme>['theme'],
  direction: CompareRow['direction'],
  side: 'a' | 'b',
) {
  const c = theme.colors;
  if (direction === 'none') {
    return { color: c.textSecondary };
  }
  if (direction === 'even') {
    return { color: c.textPrimary };
  }
  const leads = direction === side;
  return { color: leads ? c.success : c.danger };
}

// ---------- styles ----------

/** The outer column: groups stack with the section spacing the screens
 * keep. Created outside StyleSheet so the grid wrapper stays cheap. */
function createLayout(t: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    column: {
      gap: t.spacing[4],
    },
  });
}

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    groupPanel: {
      gap: 0,
      padding: 0,
      overflow: 'hidden',
    },
    groupHeader: {
      paddingHorizontal: t.spacing[3],
      paddingVertical: t.spacing[2],
      backgroundColor: c.panel,
      borderBottomWidth: 1,
      borderBottomColor: c.panelBorder,
    },
    groupHeaderLabel: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: t.letterSpacing.micro,
    },

    // The face-off row: both values mirror around the center label, so
    // A's cell right-aligns toward the label and B's left-aligns toward
    // it. The hairline separators are the table family's own.
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing[2],
      paddingHorizontal: t.spacing[3],
      paddingVertical: t.spacing[2],
      minHeight: t.layout.controlHeight,
      borderBottomWidth: 1,
      borderBottomColor: c.hairline,
    },
    valueCellA: {
      flexBasis: VALUE_BASIS,
      flexGrow: 0,
      flexShrink: 0,
      alignItems: 'flex-end',
    },
    valueCellB: {
      flexBasis: VALUE_BASIS,
      flexGrow: 0,
      flexShrink: 0,
      alignItems: 'flex-start',
    },
    valueText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.semibold,
      fontVariant: ['tabular-nums'],
    },
    labelCell: {
      flex: 1,
      flexGrow: 1,
      flexShrink: 1,
      alignItems: 'center',
      gap: 0,
      minWidth: 0,
    },
    labelText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.medium,
      color: c.textSecondary,
      textAlign: 'center',
    },
    // The delta line under the label: the leader's margin, always in the
    // leader's green so the number, the leading value, and the verdict
    // agree on one side; a tie keeps the quiet ink.
    deltaText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      fontVariant: ['tabular-nums'],
      letterSpacing: t.letterSpacing.micro,
    },
    deltaLeading: {
      color: c.success,
    },
    deltaEven: {
      color: c.textMuted,
    },
  });
}