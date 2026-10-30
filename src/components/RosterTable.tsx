import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { clanRoleLabel } from '../lib/clan-role';
import { linkEnterActivation } from '../lib/link-activation';
import LeagueRank from './LeagueRank';
import type { RosterSortDirection, RosterSortKey, RosterSortState } from '../lib/roster-sort';
import type { ClanMember } from '../api/clan';

// The roster's table presentation (07 section 4), rendered at 768 px and up
// (NFR-05). Sortable columns are the six FR-04 names: role, Town Hall,
// trophies, donations given, donations received, XP. The league moved up
// against the member (the owner's layout): the RANK column carries the tier
// icon with the rank number parsed out of the tier name, and a separate
// leading # column carries the member's position in the current order
// (the owner's call), the same shape the needs-attention table opens with
// so the two tables read as one family. The member column after it is name
// and tag. The ratio chip no longer lives here; the Needs Attention tab
// renders its own table (the owner's call), so this table shows the plain
// roster.
//
// Structure and keyboard path follow the house pattern the search results
// already use: the table container carries the grid role, the header row
// carries row + columnheader roles with the sort control as a button
// inside each sortable columnheader, and each body row is a link (07
// section 6 "roster rows (as links)") whose accessibility label reads the
// whole row, so a screen reader hears the member without cell roles
// orphaned inside a link.
//
// The roster renders in page flow: the rows are plain children of the
// table panel and the browser scrollbar owns the scrolling. A clan caps at
// 50 members, so the whole table renders at once with no virtualization
// and no inner scroll window that fights the page scroll (07 section 3).

// Column layouts. The name column flexes from a modest basis and the six
// label/metric columns grow a small share each, so wide viewports spread
// the slack across the whole row instead of pouring all of it into the
// name column (the owner's "name column is too wide" note): at the 1280 px
// content max the name lands near 300 px rather than the ~500 px a lone
// flex column would take. # and rank stay fixed (an icon and one- or
// two-digit numbers never need more). At the 768 px floor the fixed
// columns plus the name's basis sum to about 690 px, leaving the name
// column its shrink slack; below 768 the card presentation takes over
// entirely.
const NAME_BASIS = 160;
const COLUMN_GROW = 0.4;
const COLUMN_WIDTHS = {
  number: 40,
  rank: 64,
  role: 88,
  townHall: 48,
  trophies: 80,
  donations: 72,
  received: 84,
  xp: 48,
} as const;

// Micro-label tracking: the one-off 0.6 px tracking the design language
// pairs with uppercase micro labels (StatChip keeps the same constant).
const HEADER_LABEL_TRACKING = 0.6;

const SORT_ARROW: Record<RosterSortDirection, string> = {
  asc: '↑',
  desc: '↓',
};

type ColumnId = 'number' | 'rank' | 'name' | RosterSortKey;

interface ColumnSpec {
  id: ColumnId;
  label: string;
  /** The full name a screen reader hears; the visible label stays terse. */
  accessibilityLabel: string;
  sortable: boolean;
  /** Which edge the label and values align to; metric columns read right. */
  align: 'left' | 'right';
}

const BASE_COLUMNS: ReadonlyArray<ColumnSpec> = [
  {
    id: 'number',
    label: '#',
    accessibilityLabel: 'Position in the roster',
    sortable: false,
    align: 'right',
  },
  { id: 'rank', label: 'Rank', accessibilityLabel: 'League rank', sortable: false, align: 'left' },
  { id: 'name', label: 'Name', accessibilityLabel: 'Member name and tag', sortable: false, align: 'left' },
  { id: 'role', label: 'Role', accessibilityLabel: 'Clan role', sortable: true, align: 'left' },
  { id: 'townHall', label: 'TH', accessibilityLabel: 'Town Hall level', sortable: true, align: 'right' },
  { id: 'trophies', label: 'Trophies', accessibilityLabel: 'Trophies', sortable: true, align: 'right' },
  { id: 'donations', label: 'Donations', accessibilityLabel: 'Donations given', sortable: true, align: 'right' },
  { id: 'received', label: 'Received', accessibilityLabel: 'Donations received', sortable: true, align: 'right' },
  { id: 'xp', label: 'XP', accessibilityLabel: 'Experience level', sortable: true, align: 'right' },
];

export interface RosterTableProps {
  /** The members to render, already in the order the caller wants. */
  members: ClanMember[];
  /** The current sort state; drives the active column's arrow and label. */
  sort: RosterSortState;
  /** Fired when a sortable column header is pressed. */
  onPressColumn: (key: RosterSortKey) => void;
  /** Fired with the member's tag when a row is tapped (FR-04). */
  onPressMember: (tag: string) => void;
}

export default function RosterTable({
  members,
  sort,
  onPressColumn,
  onPressMember,
}: RosterTableProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View accessibilityRole="grid" accessibilityLabel="Clan roster" style={styles.table}>
      <HeaderRow
        styles={styles}
        sort={sort}
        onPressColumn={onPressColumn}
        columns={BASE_COLUMNS}
      />
      {members.map((member, index) => (
        <RosterRow
          key={member.tag}
          member={member}
          position={index + 1}
          styles={styles}
          onPress={() => onPressMember(member.tag)}
        />
      ))}
    </View>
  );
}

// ---------- header row ----------

interface HeaderRowProps {
  styles: ReturnType<typeof createStyles>;
  sort: RosterSortState;
  onPressColumn: (key: RosterSortKey) => void;
  columns: ReadonlyArray<ColumnSpec>;
}

function HeaderRow({ styles, sort, onPressColumn, columns }: HeaderRowProps) {
  return (
    <View accessibilityRole="row" style={styles.headerRow}>
      {columns.map((column) => {
        const active = sort.key === column.id;
        const labelAlign =
          column.align === 'right' ? styles.headerLabelRight : styles.headerLabelLeft;
        if (!column.sortable) {
          return (
            <View key={column.id} accessibilityRole="columnheader" style={columnStyle(column.id, styles)}>
              <Text style={[styles.headerLabel, labelAlign]}>{column.label}</Text>
            </View>
          );
        }
        return (
          <View key={column.id} accessibilityRole="columnheader" style={columnStyle(column.id, styles)}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                active ? `${column.accessibilityLabel}, sorted ${sort.direction}` : column.accessibilityLabel
              }
              accessibilityHint="Sorts the roster by this column. Press again to reverse; a third press returns to clan order."
              onPress={() => onPressColumn(column.id as RosterSortKey)}
              style={({ pressed }) => [
                styles.headerButton,
                pressed && styles.headerButtonPressed,
              ]}
            >
              <Text style={[styles.headerLabel, labelAlign, active && styles.headerLabelActive]}>
                {column.label}
                {active ? ` ${SORT_ARROW[sort.direction]}` : ''}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

// ---------- body row ----------

interface RosterRowProps {
  member: ClanMember;
  /** 1-based position in the rendered order: the # column. Clan order by
   * default, the active sort otherwise, so the number is the order the
   * visitor is looking at made visible. */
  position: number;
  styles: ReturnType<typeof createStyles>;
  onPress: () => void;
}

function RosterRow({ member, position, styles, onPress }: RosterRowProps) {
  const leagueName = member.leagueTier?.name ?? 'Unranked';
  // The whole row is the link (FR-04 "tapping a row opens that player"),
  // so the label reads the full row for screen readers and the hint says
  // where it goes. Same contract as the search result cards. The position
  // leads the label the same way the needs-attention table's does.
  const rowLabel = `Number ${position}, ${member.name}, ${clanRoleLabel(member.role)}, town hall ${member.townHallLevel}, ${member.trophies} trophies, ${leagueName}, donated ${member.donations}, received ${member.donationsReceived}, experience level ${member.expLevel}`;
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
      <View style={columnStyle('townHall', styles)}>
        <Text style={styles.cellNumber}>{member.townHallLevel}</Text>
      </View>
      <View style={columnStyle('trophies', styles)}>
        <Text style={styles.cellNumber}>{member.trophies}</Text>
      </View>
      <View style={columnStyle('donations', styles)}>
        <Text style={styles.cellNumber}>{member.donations}</Text>
      </View>
      <View style={columnStyle('received', styles)}>
        <Text style={styles.cellNumber}>{member.donationsReceived}</Text>
      </View>
      <View style={columnStyle('xp', styles)}>
        <Text style={styles.cellNumber}>{member.expLevel}</Text>
      </View>
    </Pressable>
  );
}

/** The layout each column id maps to: fixed width for metric columns,
 * flex for the member column. One table, so one place. */
function columnStyle(id: ColumnId, styles: ReturnType<typeof createStyles>) {
  switch (id) {
    case 'number':
      return styles.columnNumber;
    case 'rank':
      return styles.columnRank;
    case 'name':
      return styles.columnName;
    case 'role':
      return styles.columnRole;
    case 'townHall':
      return styles.columnTownHall;
    case 'trophies':
      return styles.columnTrophies;
    case 'donations':
      return styles.columnDonations;
    case 'received':
      return styles.columnReceived;
    case 'xp':
      return styles.columnXp;
  }
}

// ---------- styles ----------

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    // The table panel: the header row and every body row as plain children
    // in page flow. The browser scrollbar owns the scrolling (07 section 3),
    // so the panel just draws its chrome around whatever height the rows
    // add up to.
    table: {
      backgroundColor: c.panelRaised,
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorder,
      overflow: 'hidden',
    },

    // header row
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing[2],
      paddingHorizontal: t.spacing[3],
      paddingVertical: t.spacing[1],
      backgroundColor: c.panel,
      borderBottomWidth: 1,
      borderBottomColor: c.panelBorder,
    },
    headerButton: {
      alignSelf: 'stretch',
      minHeight: t.layout.touchTargetMin,
      justifyContent: 'center',
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    headerButtonPressed: {
      opacity: 0.7,
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
    headerLabelActive: {
      color: c.textPrimary,
      fontWeight: t.fontWeight.semibold,
    },

    // body rows
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

    // column layouts: # and rank fixed; the name column flexes from a
    // modest basis; the six label/metric columns take fixed widths but
    // grow a small share so wide viewports do not dump every spare pixel
    // into the name column
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
    columnTownHall: {
      width: COLUMN_WIDTHS.townHall,
      flexGrow: COLUMN_GROW,
      flexShrink: 0,
      alignItems: 'flex-end',
    },
    columnTrophies: {
      width: COLUMN_WIDTHS.trophies,
      flexGrow: COLUMN_GROW,
      flexShrink: 0,
      alignItems: 'flex-end',
    },
    columnDonations: {
      width: COLUMN_WIDTHS.donations,
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
    columnXp: {
      width: COLUMN_WIDTHS.xp,
      flexGrow: COLUMN_GROW,
      flexShrink: 0,
      alignItems: 'flex-end',
    },
  });
}
