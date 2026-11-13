import { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import Glyph from './Glyph';
import ResultChip from './ResultChip';
import { formatWarPercent } from '../lib/war-standings';
import { formatWarLogDate } from '../lib/war-efficiency';
import type { WarlogEntry } from '../api/warlog';

// The war log's table presentation (T-M3-2, FR-11), rendered at 768 px
// and up: one row per war, newest first, RESULT | OPPONENT | STARS |
// DESTRUCTION | ATTACKS | SIZE | ENDED. The result chip carries the
// verdict's color; the score cells read both sides with the viewed
// clan's figure in primary ink and the opponent's muted, the same
// ours-then-theirs order the game's own war result screen keeps.
//
// No sort controls and no row links, the war member table's own calls:
// the order is the game's (newest war first), and a logged war is a
// fact to read, not an entity to open — the opponent's live clan page
// is a later call if the log earns it. Structure follows the house
// pattern (07 section 4): grid role on the container, row and
// columnheader roles, and each body row an accessibility label that
// reads the whole war.
//
// Column widths keep the roster table's own rule (the owner's
// consistency note): fixed narrow columns, the opponent flexing from a
// modest basis, so the log table and the roster read as one family.

const OPPONENT_BASIS = 180;
const COLUMN_GROW = 0.4;
const COLUMN_WIDTHS = {
  result: 84,
  stars: 96,
  destruction: 136,
  attacks: 84,
  teamSize: 56,
  ended: 116,
} as const;

/** The opponent badge slot: API icon in a fixed box so a slow CDN load
 * never reflows the row. */
const BADGE_SLOT = 24;

interface ColumnSpec {
  id: 'result' | 'opponent' | 'stars' | 'destruction' | 'attacks' | 'teamSize' | 'ended';
  label: string;
  /** The full name a screen reader hears; the visible label stays terse. */
  accessibilityLabel: string;
  align: 'left' | 'right';
}

const COLUMNS: ReadonlyArray<ColumnSpec> = [
  { id: 'result', label: 'Result', accessibilityLabel: 'War result', align: 'left' },
  { id: 'opponent', label: 'Opponent', accessibilityLabel: 'Opponent clan', align: 'left' },
  { id: 'stars', label: 'Stars', accessibilityLabel: 'Stars, our clan then the opponent', align: 'right' },
  { id: 'destruction', label: 'Destruction', accessibilityLabel: 'Destruction, our clan then the opponent', align: 'right' },
  { id: 'attacks', label: 'Attacks', accessibilityLabel: 'Attacks used over the allowance', align: 'right' },
  { id: 'teamSize', label: 'Size', accessibilityLabel: 'Team size', align: 'right' },
  { id: 'ended', label: 'Ended', accessibilityLabel: 'When the war ended', align: 'right' },
];

/** The attacks cell: "5 / 10" when the entry carries both halves of the
 * allowance, the bare count when it does not. */
function attacksValue(entry: WarlogEntry): string {
  const allowed = entry.teamSize > 0 && entry.attacksPerMember > 0
    ? entry.teamSize * entry.attacksPerMember
    : null;
  return allowed !== null ? `${entry.clan.attackCount} / ${allowed}` : String(entry.clan.attackCount);
}

export interface WarlogTableProps {
  /** The loaded wars, newest first from the parse. */
  entries: readonly WarlogEntry[];
  /** A short label for the table's accessibility name; the visible
   * heading is the screen's. */
  accessibilityLabel: string;
}

export default function WarlogTable({ entries, accessibilityLabel }: WarlogTableProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View accessibilityRole="grid" accessibilityLabel={accessibilityLabel} style={styles.table}>
      <View accessibilityRole="row" style={styles.headerRow}>
        {COLUMNS.map((column) => (
          <View key={column.id} accessibilityRole="columnheader" style={columnStyle(column.id, styles)}>
            <Text
              style={[
                styles.headerLabel,
                column.align === 'right' ? styles.headerLabelRight : styles.headerLabelLeft,
              ]}
            >
              {column.label}
            </Text>
          </View>
        ))}
      </View>
      {entries.map((entry, index) => (
        <WarlogRow key={entry.clan.tag + String(entry.endTimeMs ?? index)} entry={entry} styles={styles} />
      ))}
    </View>
  );
}

// ---------- body row ----------

interface WarlogRowProps {
  entry: WarlogEntry;
  styles: ReturnType<typeof createStyles>;
}

function WarlogRow({ entry, styles }: WarlogRowProps) {
  const { theme } = useTheme();
  // A league season carries no single opponent (the payload's opponent
  // is degenerate) and its stars, destruction, and attacks accumulate
  // across seven rounds, so the both-sides score cells and the
  // per-war allowance would lie. The row says what a season honestly
  // is: the league chip, the season's own totals, no opponent figures.
  const isLeague = entry.result === 'league';
  const opponentName = entry.opponent.name !== '' ? entry.opponent.name : 'Unknown clan';
  const ended = entry.endTimeMs !== undefined ? formatWarLogDate(entry.endTimeMs) : '\u2014';
  const rowLabel = isLeague
    ? `League season, team size ${entry.teamSize}, ${entry.clan.attackCount} attacks, ${entry.clan.stars} stars, ${entry.endTimeMs !== undefined ? `ended ${ended}` : 'end time unknown'}`
    : `${resultWord(entry.result)} against ${opponentName}, ${entry.clan.stars} to ${entry.opponent.stars} stars, ${formatWarPercent(entry.clan.destructionPercentage)} to ${formatWarPercent(entry.opponent.destructionPercentage)} destruction, ${attacksValue(entry)} attacks, team size ${entry.teamSize}, ${entry.endTimeMs !== undefined ? `ended ${ended}` : 'end time unknown'}`;
  return (
    <View accessibilityRole="row" accessibilityLabel={rowLabel} style={styles.row}>
      <View style={columnStyle('result', styles)}>
        <ResultChip result={entry.result} />
      </View>
      <View style={columnStyle('opponent', styles)}>
        {isLeague ? (
          <Text style={styles.seasonName} numberOfLines={1}>
            League season
          </Text>
        ) : (
          <View style={styles.opponentCell}>
            {entry.opponent.badgeUrl !== null ? (
              <Image
                source={{ uri: entry.opponent.badgeUrl }}
                style={styles.badge}
                accessibilityLabel={`${opponentName} clan badge`}
              />
            ) : (
              <View
                style={styles.badgePlaceholder}
                accessibilityLabel={`${opponentName} clan badge`}
              />
            )}
            <Text style={styles.opponentName} numberOfLines={1}>
              {opponentName}
            </Text>
          </View>
        )}
      </View>
      <View style={columnStyle('stars', styles)}>
        <View style={styles.bothCell}>
          <Glyph name="star" color={theme.colors.accent} />
          <Text style={styles.cellNumber}>{entry.clan.stars}</Text>
          {!isLeague ? (
            <Text style={styles.cellOther}>{`\u2013 ${entry.opponent.stars}`}</Text>
          ) : null}
        </View>
      </View>
      <View style={columnStyle('destruction', styles)}>
        {isLeague ? (
          <Text style={styles.cellDash}>{'\u2014'}</Text>
        ) : (
          <View style={styles.bothCell}>
            <Text style={styles.cellNumber}>{formatWarPercent(entry.clan.destructionPercentage)}</Text>
            <Text
              style={styles.cellOther}
            >{`\u2013 ${formatWarPercent(entry.opponent.destructionPercentage)}`}</Text>
          </View>
        )}
      </View>
      <View style={columnStyle('attacks', styles)}>
        <Text style={styles.cellNumber}>
          {isLeague ? String(entry.clan.attackCount) : attacksValue(entry)}
        </Text>
      </View>
      <View style={columnStyle('teamSize', styles)}>
        <Text style={styles.cellNumber}>{entry.teamSize}</Text>
      </View>
      <View style={columnStyle('ended', styles)}>
        <Text style={entry.endTimeMs !== undefined ? styles.cellDate : styles.cellDash}>{ended}</Text>
      </View>
    </View>
  );
}

/** The result word an accessibility label reads, matching the chip. */
function resultWord(result: WarlogEntry['result']): string {
  switch (result) {
    case 'win':
      return 'Win';
    case 'lose':
      return 'Loss';
    case 'tie':
      return 'Tie';
    case 'ongoing':
      return 'Ongoing war';
    case 'league':
      return 'League season';
  }
}

/** The layout each column id maps to, the roster table's pattern. */
function columnStyle(
  id: ColumnSpec['id'],
  styles: ReturnType<typeof createStyles>,
) {
  switch (id) {
    case 'result':
      return styles.columnResult;
    case 'opponent':
      return styles.columnOpponent;
    case 'stars':
      return styles.columnStars;
    case 'destruction':
      return styles.columnDestruction;
    case 'attacks':
      return styles.columnAttacks;
    case 'teamSize':
      return styles.columnTeamSize;
    case 'ended':
      return styles.columnEnded;
  }
}

// ---------- styles ----------

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    // The table panel: header and body rows as plain children in page
    // flow, the browser scrollbar owning the scrolling (07 section 3).
    table: {
      backgroundColor: c.panelRaised,
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorder,
      borderTopColor: c.panelHighlight,
      overflow: 'hidden',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing[2],
      paddingHorizontal: t.spacing[3],
      paddingVertical: t.spacing[1],
      backgroundColor: c.panel,
      borderBottomWidth: 1,
      borderBottomColor: c.panelBorder,
      minHeight: t.layout.controlHeight,
    },
    headerLabel: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: t.letterSpacing.micro,
    },
    headerLabelLeft: {
      textAlign: 'left',
    },
    headerLabelRight: {
      textAlign: 'right',
    },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing[2],
      paddingHorizontal: t.spacing[3],
      minHeight: t.layout.controlHeight,
      borderBottomWidth: 1,
      borderBottomColor: c.hairline,
    },
    opponentCell: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing[2],
      minWidth: 0,
    },
    badge: {
      width: BADGE_SLOT,
      height: BADGE_SLOT,
      borderRadius: t.radius[1],
      backgroundColor: c.panel,
    },
    badgePlaceholder: {
      width: BADGE_SLOT,
      height: BADGE_SLOT,
      borderRadius: t.radius[1],
      backgroundColor: c.hairline,
    },
    opponentName: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
      flexShrink: 1,
    },
    // The league season's name cell: the same text treatment as an
    // opponent name, quieter, because "League season" is a description
    // rather than an identity.
    seasonName: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textSecondary,
      flexShrink: 1,
    },
    bothCell: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: t.spacing[1],
    },
    cellNumber: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textPrimary,
      fontVariant: ['tabular-nums'],
      textAlign: 'right',
    },
    // The opponent's half of a both-sides cell: same figures, quieter
    // ink, so the viewed clan's column reads first.
    cellOther: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textMuted,
      fontVariant: ['tabular-nums'],
      textAlign: 'right',
    },
    cellDate: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textSecondary,
      fontVariant: ['tabular-nums'],
      textAlign: 'right',
    },
    cellDash: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textMuted,
      textAlign: 'right',
    },

    // Column layouts: the roster table's own pattern. The result and
    // metric columns fixed; the opponent column flexes from the same
    // modest basis; the metric columns grow the same small share.
    columnResult: {
      width: COLUMN_WIDTHS.result,
      flexGrow: COLUMN_GROW,
      flexShrink: 0,
      alignItems: 'flex-start',
    },
    columnOpponent: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: OPPONENT_BASIS,
    },
    columnStars: {
      width: COLUMN_WIDTHS.stars,
      flexGrow: COLUMN_GROW,
      flexShrink: 0,
    },
    columnDestruction: {
      width: COLUMN_WIDTHS.destruction,
      flexGrow: COLUMN_GROW,
      flexShrink: 0,
      alignItems: 'flex-end',
    },
    columnAttacks: {
      width: COLUMN_WIDTHS.attacks,
      flexGrow: COLUMN_GROW,
      flexShrink: 0,
      alignItems: 'flex-end',
    },
    columnTeamSize: {
      width: COLUMN_WIDTHS.teamSize,
      flexGrow: COLUMN_GROW,
      flexShrink: 0,
      alignItems: 'flex-end',
    },
    columnEnded: {
      width: COLUMN_WIDTHS.ended,
      flexGrow: COLUMN_GROW,
      flexShrink: 0,
      alignItems: 'flex-end',
    },
  });
}
