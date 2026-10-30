import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import LeagueRank from './LeagueRank';
import RatioFlag from './RatioFlag';
import { clanRoleLabel } from '../lib/clan-role';
import { linkEnterActivation } from '../lib/link-activation';
import type { DonationVerdict } from '../lib/donation-balance';
import type { ClanMember } from '../api/clan';

// The needs-attention table (FR-05, SR-12): the worst-first donation view
// the Needs Attention tab renders, its own table instead of a mode of the
// roster (the owner's layout). The columns are exactly the owner's list:
// NUMBER | RANK | NAME | ROLE | DONATED | RECEIVED | RATIO | ATTACKS LEFT.
// Trophies, XP, and Town Hall are deliberately absent, this view is about
// who owes the clan donations and who still holds war attacks, not about
// ladder standing.
//
// No column sorts: the row order is the engine's judgment (worst-first by
// donation deficit, lib/donation-balance.ts), so a sort control here would
// be a control that lies. The NUMBER column is that order made visible
// (position 1 is the worst offender), rendered as the same plain number
// cell the roster's # column renders so the two tables read as one family.
//
// Structure follows the roster table's house pattern (07 section 4): the
// container carries the grid role, the header row carries row +
// columnheader roles, and each body row is a link whose accessibility
// label reads the whole row. Rows render in page flow like the roster's,
// the browser scrollbar owns the scrolling (07 section 3).

// Column widths, the roster table's own rule (the owner's consistency
// note): the number and rank columns fixed and narrow at the same values
// the roster uses, the name column flexes from the same modest basis, and
// every metric column grows the same small share, so a wide viewport
// spreads the slack across the row instead of pouring it all into the
// name column (the same rebalance the roster got). At the 768 px floor
// the fixed columns plus the name's basis sum past the column, leaving
// the name its shrink slack, the same floor behavior the roster keeps.
const NAME_BASIS = 160;
const COLUMN_GROW = 0.4;
const COLUMN_WIDTHS = {
  number: 40,
  rank: 64,
  role: 88,
  donated: 72,
  received: 84,
  ratio: 84,
  attacks: 100,
} as const;

// Micro-label tracking, the same constant the roster header keeps.
const HEADER_LABEL_TRACKING = 0.6;

interface ColumnSpec {
  id: 'number' | 'rank' | 'name' | 'role' | 'donated' | 'received' | 'ratio' | 'attacks';
  label: string;
  /** The full name a screen reader hears; the visible label stays terse. */
  accessibilityLabel: string;
  align: 'left' | 'right' | 'center';
}

const COLUMNS: ReadonlyArray<ColumnSpec> = [
  { id: 'number', label: '#', accessibilityLabel: 'Rank in the worst-first order', align: 'right' },
  { id: 'rank', label: 'Rank', accessibilityLabel: 'League rank', align: 'left' },
  { id: 'name', label: 'Name', accessibilityLabel: 'Member name and tag', align: 'left' },
  { id: 'role', label: 'Role', accessibilityLabel: 'Clan role', align: 'left' },
  { id: 'donated', label: 'Donated', accessibilityLabel: 'Donations given', align: 'right' },
  { id: 'received', label: 'Received', accessibilityLabel: 'Donations received', align: 'right' },
  { id: 'ratio', label: 'Ratio', accessibilityLabel: 'Donation ratio given to received', align: 'center' },
  { id: 'attacks', label: 'Attacks left', accessibilityLabel: 'War attacks left', align: 'right' },
];

export interface AttentionTableProps {
  /** The members to render, already worst-first from the engine. */
  members: ClanMember[];
  /** The balance verdicts by tag; every row renders its RatioFlag chip. */
  verdictByTag: Map<string, DonationVerdict>;
  /** Attacks the member still holds in the current war, null for a dash. */
  attacksLeft: (memberTag: string) => number | null;
  /** Fired with the member's tag when a row is tapped (FR-04). */
  onPressMember: (tag: string) => void;
}

export default function AttentionTable({
  members,
  verdictByTag,
  attacksLeft,
  onPressMember,
}: AttentionTableProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View accessibilityRole="grid" accessibilityLabel="Needs attention" style={styles.table}>
      <View accessibilityRole="row" style={styles.headerRow}>
        {COLUMNS.map((column) => (
          <View key={column.id} accessibilityRole="columnheader" style={columnStyle(column.id, styles)}>
            <Text
              style={[
                styles.headerLabel,
                column.align === 'right'
                  ? styles.headerLabelRight
                  : column.align === 'center'
                    ? styles.headerLabelCenter
                    : styles.headerLabelLeft,
              ]}
            >
              {column.label}
            </Text>
          </View>
        ))}
      </View>
      {members.map((member, index) => (
        <AttentionRow
          key={member.tag}
          member={member}
          position={index + 1}
          verdict={verdictByTag.get(member.tag)}
          attacksLeft={attacksLeft(member.tag)}
          styles={styles}
          onPress={() => onPressMember(member.tag)}
        />
      ))}
    </View>
  );
}

// ---------- body row ----------

interface AttentionRowProps {
  member: ClanMember;
  /** 1-based position in the worst-first order. */
  position: number;
  verdict?: DonationVerdict;
  attacksLeft: number | null;
  styles: ReturnType<typeof createStyles>;
  onPress: () => void;
}

function AttentionRow({
  member,
  position,
  verdict,
  attacksLeft,
  styles,
  onPress,
}: AttentionRowProps) {
  const leagueName = member.leagueTier?.name ?? 'Unranked';
  // The whole row is the link (FR-04), the same contract the roster rows
  // and the search cards keep: the label reads the row, the hint says
  // where the tap goes.
  const rowLabel = `Number ${position}, ${member.name}, ${clanRoleLabel(member.role)}, ${leagueName}, donated ${member.donations}, received ${member.donationsReceived}, ${attacksLeft !== null ? `${attacksLeft} war attacks left` : 'no war attack data'}`;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={rowLabel}
      accessibilityHint="Opens this member's player detail screen."
      onPress={onPress}
      onKeyDown={linkEnterActivation(onPress)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={columnStyle('number', styles)}>
        <Text style={styles.cellNumber}>{position}</Text>
      </View>
      <View style={columnStyle('rank', styles)}>
        <LeagueRank tier={member.leagueTier} />
      </View>
      <View style={columnStyle('name', styles)}>
        <Text style={styles.name} numberOfLines={1}>
          {member.name}
        </Text>
        <Text style={styles.tag} numberOfLines={1}>
          {member.tag}
        </Text>
      </View>
      <View style={columnStyle('role', styles)}>
        <Text style={styles.cellText} numberOfLines={1}>
          {clanRoleLabel(member.role)}
        </Text>
      </View>
      <View style={columnStyle('donated', styles)}>
        <Text style={styles.cellNumber}>{member.donations}</Text>
      </View>
      <View style={columnStyle('received', styles)}>
        <Text style={styles.cellNumber}>{member.donationsReceived}</Text>
      </View>
      <View style={columnStyle('ratio', styles)}>
        {verdict ? <RatioFlag verdict={verdict} /> : null}
      </View>
      <View style={columnStyle('attacks', styles)}>
        <Text style={attacksLeft !== null ? styles.cellNumber : styles.cellDash}>
          {attacksLeft !== null ? attacksLeft : '\u2014'}
        </Text>
      </View>
    </Pressable>
  );
}

/** The layout each column id maps to, the roster table's pattern. */
function columnStyle(
  id: ColumnSpec['id'],
  styles: ReturnType<typeof createStyles>,
) {
  switch (id) {
    case 'number':
      return styles.columnNumber;
    case 'rank':
      return styles.columnRank;
    case 'name':
      return styles.columnName;
    case 'role':
      return styles.columnRole;
    case 'donated':
      return styles.columnDonated;
    case 'received':
      return styles.columnReceived;
    case 'ratio':
      return styles.columnRatio;
    case 'attacks':
      return styles.columnAttacks;
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
      minHeight: t.layout.touchTargetMin,
    },
    headerLabel: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: HEADER_LABEL_TRACKING,
    },
    headerLabelLeft: {
      textAlign: 'left',
    },
    headerLabelRight: {
      textAlign: 'right',
    },
    headerLabelCenter: {
      textAlign: 'center',
    },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing[2],
      paddingHorizontal: t.spacing[3],
      minHeight: t.layout.touchTargetMin,
      borderBottomWidth: 1,
      borderBottomColor: c.hairline,
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    rowPressed: {
      backgroundColor: c.panel,
    },
    name: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
    },
    tag: {
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.xs,
      color: c.textMuted,
    },
    cellText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textSecondary,
    },
    cellNumber: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textPrimary,
      fontVariant: ['tabular-nums'],
      textAlign: 'right',
    },
    // The quiet dash for no-war-data rows: muted, not alarm-colored, the
    // same value the LeagueRank unranked cell renders.
    cellDash: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textMuted,
      textAlign: 'right',
    },

    // column layouts: the roster table's own pattern. # and rank fixed;
    // the name column flexes from the same modest basis; the metric
    // columns take fixed widths but grow the same small share so wide
    // viewports do not dump every spare pixel into the name column.
    columnNumber: {
      width: COLUMN_WIDTHS.number,
      alignItems: 'flex-end',
      flexShrink: 0,
    },
    columnRank: {
      width: COLUMN_WIDTHS.rank,
      flexShrink: 0,
    },
    columnName: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: NAME_BASIS,
    },
    columnRole: {
      width: COLUMN_WIDTHS.role,
      flexGrow: COLUMN_GROW,
      flexShrink: 0,
    },
    columnDonated: {
      width: COLUMN_WIDTHS.donated,
      flexGrow: COLUMN_GROW,
      flexShrink: 0,
      alignItems: 'flex-end',
    },
    columnReceived: {
      width: COLUMN_WIDTHS.received,
      flexGrow: COLUMN_GROW,
      flexShrink: 0,
      alignItems: 'flex-end',
    },
    columnRatio: {
      width: COLUMN_WIDTHS.ratio,
      flexGrow: COLUMN_GROW,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    columnAttacks: {
      width: COLUMN_WIDTHS.attacks,
      flexGrow: COLUMN_GROW,
      flexShrink: 0,
      alignItems: 'flex-end',
    },
  });
}
