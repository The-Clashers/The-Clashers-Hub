import { useMemo } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { clanRoleLabel } from '../lib/clan-role';
import { linkEnterActivation } from '../lib/link-activation';
import RatioFlag from './RatioFlag';
import type { RosterSortDirection, RosterSortKey, RosterSortState } from '../lib/roster-sort';
import type { DonationVerdict } from '../lib/donation-balance';
import type { ClanMember } from '../api/clan';

// The roster's table presentation (07 section 4), rendered at 768 px and up
// (NFR-05). Sortable columns are the six FR-04 names: role, Town Hall,
// trophies, donations given, donations received, XP. Name and League are
// identity/display columns and stay fixed.
//
// Structure and keyboard path follow the house pattern the search results
// already use: the table container carries the grid role, the header row
// carries row + columnheader roles with the sort control as a button
// inside each sortable columnheader, and each body row is a link (07
// section 6 "roster rows (as links)") whose accessibility label reads the
// whole row, so a screen reader hears the member without cell roles
// orphaned inside a link.
//
// The FlatList owns scrolling (the same deliberate choice the search screen
// made): virtualization needs the list to be the scroll container, and a
// 50-member roster is the normal case (07 section 3). The header row docks
// sticky so the sort controls stay reachable while the roster scrolls.

// Column layouts. The two text columns (name, league) flex; the metric
// columns take fixed widths so columns of tabular numbers line up without
// the header guessing at content width. At the 768 px floor the fixed
// columns sum to about 460 px, leaving the flexes the rest; below 768 the
// card presentation takes over entirely.
const NAME_FLEX = 1.6;
const LEAGUE_FLEX = 1;
const COLUMN_WIDTHS = {
  role: 92,
  townHall: 52,
  trophies: 84,
  donations: 76,
  received: 88,
  xp: 56,
  ratio: 96,
} as const;

// The league icon slot (07 section 7): an API icon in a fixed 24 px box so
// a slow CDN load never reflows the row.
const LEAGUE_ICON_SLOT = 24;

// Micro-label tracking: the one-off 0.6 px tracking the design language
// pairs with uppercase micro labels (StatChip keeps the same constant).
const HEADER_LABEL_TRACKING = 0.6;

// Enough roster rows to fill a laptop viewport before the first batch
// render; a clan caps at 50 members, so the batches stay short.
const INITIAL_ROWS_TO_RENDER = 12;
const ROWS_PER_BATCH = 12;

const SORT_ARROW: Record<RosterSortDirection, string> = {
  asc: '↑',
  desc: '↓',
};

type ColumnId = 'name' | RosterSortKey | 'league' | 'ratio';

interface ColumnSpec {
  id: ColumnId;
  label: string;
  /** The full name a screen reader hears; the visible label stays terse. */
  accessibilityLabel: string;
  sortable: boolean;
  /** Which edge the label and values align to; metric columns read right,
   * the ratio chip reads center. */
  align: 'left' | 'right' | 'center';
}

// The ratio column is appended only when the needs-attention mode is on,
// so the table's column count is stable within a mode and a toggle does
// not cause a mid-scroll layout shift on the rows already rendered.
const BASE_COLUMNS: ReadonlyArray<ColumnSpec> = [
  { id: 'name', label: 'Member', accessibilityLabel: 'Member name and tag', sortable: false, align: 'left' },
  { id: 'role', label: 'Role', accessibilityLabel: 'Clan role', sortable: true, align: 'left' },
  { id: 'townHall', label: 'TH', accessibilityLabel: 'Town Hall level', sortable: true, align: 'right' },
  { id: 'trophies', label: 'Trophies', accessibilityLabel: 'Trophies', sortable: true, align: 'right' },
  { id: 'league', label: 'League', accessibilityLabel: 'League', sortable: false, align: 'left' },
  { id: 'donations', label: 'Donations', accessibilityLabel: 'Donations given', sortable: true, align: 'right' },
  { id: 'received', label: 'Received', accessibilityLabel: 'Donations received', sortable: true, align: 'right' },
  { id: 'xp', label: 'XP', accessibilityLabel: 'Experience level', sortable: true, align: 'right' },
];

const RATIO_COLUMN: ColumnSpec = {
  id: 'ratio',
  label: 'Ratio',
  accessibilityLabel: 'Donation ratio given to received',
  sortable: false,
  align: 'center',
};

export interface RosterTableProps {
  /** The members to render, already in the order the caller wants. */
  members: ClanMember[];
  /** The current sort state; drives the active column's arrow and label. */
  sort: RosterSortState;
  /** Fired when a sortable column header is pressed. */
  onPressColumn: (key: RosterSortKey) => void;
  /** Fired with the member's tag when a row is tapped (FR-04). */
  onPressMember: (tag: string) => void;
  /** When set, a Ratio column is appended and each flagged row renders the
   * RatioFlag chip from its verdict. Undefined when needs-attention is off. */
  verdictByTag?: Map<string, DonationVerdict>;
  /** While the needs-attention view owns the row order, a column press does
   * not change the order, so the header buttons disable rather than show a
   * sort arrow that is not in effect. Undefined (enabled) otherwise. */
  sortDisabled?: boolean;
}

export default function RosterTable({
  members,
  sort,
  onPressColumn,
  onPressMember,
  verdictByTag,
  sortDisabled = false,
}: RosterTableProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const showRatio = verdictByTag !== undefined;
  const columns = showRatio ? [...BASE_COLUMNS, RATIO_COLUMN] : BASE_COLUMNS;

  return (
    <View accessibilityRole="grid" accessibilityLabel="Clan roster" style={styles.grid}>
      <FlatList
        data={members}
        keyExtractor={(member) => member.tag}
        stickyHeaderIndices={[0]}
        ListHeaderComponent={
          <HeaderRow
            styles={styles}
            sort={sort}
            onPressColumn={onPressColumn}
            columns={columns}
            sortDisabled={sortDisabled}
          />
        }
        renderItem={({ item }) => (
          <RosterRow
            member={item}
            styles={styles}
            columns={columns}
            verdict={verdictByTag?.get(item.tag)}
            onPress={() => onPressMember(item.tag)}
          />
        )}
        initialNumToRender={INITIAL_ROWS_TO_RENDER}
        maxToRenderPerBatch={ROWS_PER_BATCH}
        contentContainerStyle={styles.listContent}
        style={styles.list}
      />
    </View>
  );
}

// ---------- header row ----------

interface HeaderRowProps {
  styles: ReturnType<typeof createStyles>;
  sort: RosterSortState;
  onPressColumn: (key: RosterSortKey) => void;
  columns: ReadonlyArray<ColumnSpec>;
  sortDisabled: boolean;
}

function HeaderRow({ styles, sort, onPressColumn, columns, sortDisabled }: HeaderRowProps) {
  return (
    <View accessibilityRole="row" style={styles.headerRow}>
      {columns.map((column) => {
        const active = sort.key === column.id;
        const labelAlign =
          column.align === 'right'
            ? styles.headerLabelRight
            : column.align === 'center'
              ? styles.headerLabelCenter
              : styles.headerLabelLeft;
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
              disabled={sortDisabled}
              style={({ pressed }) => [
                styles.headerButton,
                pressed && styles.headerButtonPressed,
                sortDisabled && styles.headerButtonDisabled,
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
  styles: ReturnType<typeof createStyles>;
  columns: ReadonlyArray<ColumnSpec>;
  verdict?: DonationVerdict;
  onPress: () => void;
}

function RosterRow({ member, styles, columns, verdict, onPress }: RosterRowProps) {
  const leagueName = member.league?.name ?? 'Unranked';
  const leagueIcon = member.league?.iconUrls?.small;
  // The whole row is the link (FR-04 "tapping a row opens that player"),
  // so the label reads the full row for screen readers and the hint says
  // where it goes. Same contract as the search result cards.
  const rowLabel = `${member.name}, ${clanRoleLabel(member.role)}, town hall ${member.townHallLevel}, ${member.trophies} trophies, ${leagueName}, donated ${member.donations}, received ${member.donationsReceived}, experience level ${member.expLevel}`;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={rowLabel}
      accessibilityHint="Opens this member's player detail screen."
      onPress={onPress}
      onKeyDown={linkEnterActivation(onPress)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
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
      <View style={columnStyle('league', styles)}>
        <View style={styles.leagueCell}>
          {leagueIcon ? (
            <Image
              source={{ uri: leagueIcon }}
              style={styles.leagueIcon}
              accessibilityLabel={`${leagueName} league icon`}
            />
          ) : (
            <View style={styles.leagueIcon} />
          )}
          <Text style={styles.cellText} numberOfLines={1}>
            {leagueName}
          </Text>
        </View>
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
      {columns.some((column) => column.id === 'ratio') ? (
        <View style={columnStyle('ratio', styles)}>
          {verdict ? <RatioFlag verdict={verdict} /> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

/** The layout each column id maps to: fixed width for metric columns,
 * flex for the two text columns. One table, so one place. */
function columnStyle(id: ColumnId, styles: ReturnType<typeof createStyles>) {
  switch (id) {
    case 'name':
      return styles.columnName;
    case 'role':
      return styles.columnRole;
    case 'townHall':
      return styles.columnTownHall;
    case 'trophies':
      return styles.columnTrophies;
    case 'league':
      return styles.columnLeague;
    case 'donations':
      return styles.columnDonations;
    case 'received':
      return styles.columnReceived;
    case 'xp':
      return styles.columnXp;
    case 'ratio':
      return styles.columnRatio;
  }
}

// ---------- styles ----------

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    // The grid wrapper must flex to the bounded tab content so the
    // ScrollView inside it becomes the scroll container (RN Views do not
    // shrink by default; without this the roster overflows the region and
    // the page scrolls instead, losing both virtualization and the sticky
    // header).
    grid: {
      flex: 1,
    },

    // The table panel: the roster's scroll container, with the header
    // docking over it.
    list: {
      flex: 1,
      backgroundColor: c.panelRaised,
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorder,
      overflow: 'hidden',
    },
    listContent: {
      paddingBottom: t.spacing[2],
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
      // Docked over the scrolling rows (stickyHeaderIndices), so it needs
      // to win the paint order and be opaque.
      zIndex: t.zIndex.sticky,
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
    headerButtonDisabled: {
      opacity: 0.5,
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
    leagueCell: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing[2],
    },
    leagueIcon: {
      width: LEAGUE_ICON_SLOT,
      height: LEAGUE_ICON_SLOT,
    },

    // column layouts: metric columns fixed, text columns flex
    columnName: {
      flex: NAME_FLEX,
    },
    columnRole: {
      width: COLUMN_WIDTHS.role,
    },
    columnTownHall: {
      width: COLUMN_WIDTHS.townHall,
      alignItems: 'flex-end',
    },
    columnTrophies: {
      width: COLUMN_WIDTHS.trophies,
      alignItems: 'flex-end',
    },
    columnLeague: {
      flex: LEAGUE_FLEX,
    },
    columnDonations: {
      width: COLUMN_WIDTHS.donations,
      alignItems: 'flex-end',
    },
    columnReceived: {
      width: COLUMN_WIDTHS.received,
      alignItems: 'flex-end',
    },
    columnXp: {
      width: COLUMN_WIDTHS.xp,
      alignItems: 'flex-end',
    },
    columnRatio: {
      width: COLUMN_WIDTHS.ratio,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
