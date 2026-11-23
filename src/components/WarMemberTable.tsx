import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import Glyph from './Glyph';
import {
  formatWarPercent,
  memberAverageDestruction,
  memberStars,
} from '../lib/war-standings';
import {
  formatAttackQuality,
  formatStarsPerAttack,
  memberWarImpact,
} from '../lib/war-impact';
import { linkEnterActivation } from '../lib/link-activation';
import type { WarMember } from '../api/war';

// The current-war view's per-member attack table (T-M3-1 + T-M3-7,
// FR-10, FR-12, SR-19). The columns are the requirement's own list:
// POSITION | NAME | TH | ATTACKS | STARS | S/A | DESTRUCTION | QUALITY,
// rendered for both rosters (the screen mounts one table per side) from
// the single current-war response (SR-09's no-per-member-fetch rule
// holds here too).
//
// The rows arrive already ordered by the impact engine (lib/war-
// impact.ts, T-M3-7): participants first, ordered by impact, zero-
// attack members after them in map order. The caller hands the
// display positions along (the war map's own numbers, resolved before
// reordering) so the position column keeps telling the truth about the
// map while the rows speak impact.
//
// Stars per attack is a rate, not a volume. Destruction is the average
// across the attacks the member actually used; a member with zero
// attacks shows the quiet dash, never a zero (averaging them in as
// zeros is the lie SR-19 forbids). Quality is the member's best attack
// (stars x 100 + destruction), colored against the side's participant
// average the caller computes: at or above the baseline reads success,
// below it reads danger, and the unjudged (no attacks) read the dash.
// Structure follows the house pattern (07 section 4): grid role on the
// container, row and columnheader roles on the header, and each body
// row a link whose accessibility label reads the whole row.

// Column widths, the roster table's own rule (the owner's consistency
// note): fixed narrow columns, the name flexing from a modest basis, so
// the two war tables and the roster read as one family.
const NAME_BASIS = 144;
const COLUMN_GROW = 0.4;
const COLUMN_WIDTHS = {
  position: 36,
  townHall: 48,
  attacks: 76,
  stars: 60,
  starsPerAttack: 60,
  destruction: 92,
  quality: 80,
} as const;

interface ColumnSpec {
  id:
    | 'position'
    | 'name'
    | 'townHall'
    | 'attacks'
    | 'stars'
    | 'starsPerAttack'
    | 'destruction'
    | 'quality';
  label: string;
  /** The full name a screen reader hears; the visible label stays terse. */
  accessibilityLabel: string;
  align: 'left' | 'right';
}

const COLUMNS: ReadonlyArray<ColumnSpec> = [
  { id: 'position', label: '#', accessibilityLabel: 'Position on the war map', align: 'right' },
  { id: 'name', label: 'Name', accessibilityLabel: 'Member name and tag', align: 'left' },
  { id: 'townHall', label: 'TH', accessibilityLabel: 'Town Hall level', align: 'right' },
  { id: 'attacks', label: 'Attacks', accessibilityLabel: 'Attacks used versus allowed', align: 'right' },
  { id: 'stars', label: 'Stars', accessibilityLabel: 'Stars earned', align: 'right' },
  { id: 'starsPerAttack', label: 'S/A', accessibilityLabel: 'Stars per attack', align: 'right' },
  { id: 'destruction', label: 'Destruction', accessibilityLabel: 'Average destruction', align: 'right' },
  { id: 'quality', label: 'Quality', accessibilityLabel: 'Best attack quality', align: 'right' },
];

/** The attacks cell: "2 / 2" when the payload carries the allowance,
 * the bare count when it does not. */
function attacksValue(used: number, attacksPerMember: number | undefined): string {
  return attacksPerMember !== undefined ? `${used} / ${attacksPerMember}` : String(used);
}

export interface WarMemberTableProps {
  /** The side's war roster, already ordered by the impact engine's
   * participants-first rule. */
  members: WarMember[];
  /** Attacks each member may use, when the payload says. */
  attacksPerMember?: number;
  /** Each member's display position, resolved from the payload's
   * original roster order (war map number, or index plus one); the
   * reordered rows read it so the position column stays honest. */
  positions?: ReadonlyMap<string, number>;
  /** The side's participant-average best-attack quality, the baseline
   * the quality column colors read against; null when nobody has
   * attacked yet. */
  qualityBaseline?: number | null;
  /** A short label for the table's accessibility name ("Umbra Lunaria
   * war roster"); the visible section heading is the screen's. */
  accessibilityLabel: string;
  /** Fired with the member's tag when a row is tapped. */
  onPressMember: (tag: string) => void;
}

export default function WarMemberTable({
  members,
  attacksPerMember,
  positions,
  qualityBaseline,
  accessibilityLabel,
  onPressMember,
}: WarMemberTableProps) {
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
      {members.map((member, index) => (
        <WarMemberRow
          key={member.tag}
          member={member}
          position={
            positions?.get(member.tag) ??
            (member.mapPosition > 0 ? member.mapPosition : index + 1)
          }
          attacksPerMember={attacksPerMember}
          qualityBaseline={qualityBaseline ?? null}
          styles={styles}
          onPress={() => onPressMember(member.tag)}
        />
      ))}
    </View>
  );
}

// ---------- body row ----------

interface WarMemberRowProps {
  member: WarMember;
  /** 1-based map position, or the payload index when the map did not
   * say. */
  position: number;
  attacksPerMember: number | undefined;
  qualityBaseline: number | null;
  styles: ReturnType<typeof createStyles>;
  onPress: () => void;
}

function WarMemberRow({
  member,
  position,
  attacksPerMember,
  qualityBaseline,
  styles,
  onPress,
}: WarMemberRowProps) {
  const { theme } = useTheme();
  const stars = memberStars(member);
  const averageDestruction = memberAverageDestruction(member);
  const impact = memberWarImpact(member, attacksPerMember);
  const used = member.attacks.length;
  // The quality ink reads against the participant average: at or above
  // is success, below is danger, and a member without attacks is the
  // quiet dash, unjudged.
  const qualityStyle =
    impact.bestAttackQuality === null
      ? styles.cellDash
      : qualityBaseline !== null && impact.bestAttackQuality < qualityBaseline
        ? styles.cellBelowBaseline
        : styles.cellAboveBaseline;
  // The whole row is the link, the same contract the roster, attention,
  // and card presentations keep: the label reads the row, the hint says
  // where the tap goes.
  const rowLabel = `Position ${position}, ${member.name}, town hall ${member.townHallLevel}, ${attacksValue(used, attacksPerMember)} attacks used, ${stars} stars, ${impact.starsPerAttack !== null ? `${formatStarsPerAttack(impact.starsPerAttack)} stars per attack` : 'no stars per attack yet'}, ${averageDestruction !== null ? `${formatWarPercent(averageDestruction)} average destruction` : 'no attacks yet'}, ${impact.bestAttackQuality !== null ? `best attack quality ${formatAttackQuality(impact.bestAttackQuality)}` : 'no attack quality yet'}`;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={rowLabel}
      accessibilityHint="Opens this member's player detail screen."
      onPress={onPress}
      onKeyDown={linkEnterActivation(onPress)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={columnStyle('position', styles)}>
        <Text style={styles.cellNumber}>{position}</Text>
      </View>
      <View style={columnStyle('name', styles)}>
        <Text style={styles.name} numberOfLines={1}>
          {member.name}
        </Text>
        <Text style={styles.tag} numberOfLines={1}>
          {member.tag}
        </Text>
      </View>
      <View style={columnStyle('townHall', styles)}>
        <Text style={styles.cellNumber}>{member.townHallLevel}</Text>
      </View>
      <View style={columnStyle('attacks', styles)}>
        <Text style={styles.cellNumber}>{attacksValue(used, attacksPerMember)}</Text>
      </View>
      <View style={columnStyle('stars', styles)}>
        <View style={styles.starsCell}>
          <Glyph name="star" color={theme.colors.accent} />
          <Text style={styles.cellNumber}>{stars}</Text>
        </View>
      </View>
      <View style={columnStyle('starsPerAttack', styles)}>
        <Text style={impact.starsPerAttack !== null ? styles.cellNumber : styles.cellDash}>
          {impact.starsPerAttack !== null ? formatStarsPerAttack(impact.starsPerAttack) : '\u2014'}
        </Text>
      </View>
      <View style={columnStyle('destruction', styles)}>
        <Text style={averageDestruction !== null ? styles.cellNumber : styles.cellDash}>
          {averageDestruction !== null ? formatWarPercent(averageDestruction) : '\u2014'}
        </Text>
      </View>
      <View style={columnStyle('quality', styles)}>
        <Text style={qualityStyle}>
          {impact.bestAttackQuality !== null
            ? formatAttackQuality(impact.bestAttackQuality)
            : '\u2014'}
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
    case 'position':
      return styles.columnPosition;
    case 'name':
      return styles.columnName;
    case 'townHall':
      return styles.columnTownHall;
    case 'attacks':
      return styles.columnAttacks;
    case 'stars':
      return styles.columnStars;
    case 'starsPerAttack':
      return styles.columnStarsPerAttack;
    case 'destruction':
      return styles.columnDestruction;
    case 'quality':
      return styles.columnQuality;
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
    cellNumber: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textPrimary,
      fontVariant: ['tabular-nums'],
      textAlign: 'right',
    },
    // The quiet dash for members who have not attacked: muted, not
    // alarm-colored, the same value the attention table's no-data cells
    // render.
    cellDash: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textMuted,
      textAlign: 'right',
    },
    // The quality column's two verdicts against the participant
    // average: the semantic pair the compare rows keep (07 section 4).
    cellAboveBaseline: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.success,
      fontVariant: ['tabular-nums'],
      textAlign: 'right',
    },
    cellBelowBaseline: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.danger,
      fontVariant: ['tabular-nums'],
      textAlign: 'right',
    },
    starsCell: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: t.spacing[1],
    },

    // column layouts: the roster table's own pattern. # and the metric
    // columns fixed; the name column flexes from the same modest basis;
    // the metric columns grow the same small share so wide viewports do
    // not dump every spare pixel into the name column.
    columnPosition: {
      width: COLUMN_WIDTHS.position,
      alignItems: 'flex-end',
      flexShrink: 0,
    },
    columnName: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: NAME_BASIS,
    },
    columnTownHall: {
      width: COLUMN_WIDTHS.townHall,
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
    columnStars: {
      width: COLUMN_WIDTHS.stars,
      flexGrow: COLUMN_GROW,
      flexShrink: 0,
    },
    columnStarsPerAttack: {
      width: COLUMN_WIDTHS.starsPerAttack,
      flexGrow: COLUMN_GROW,
      flexShrink: 0,
      alignItems: 'flex-end',
    },
    columnDestruction: {
      width: COLUMN_WIDTHS.destruction,
      flexGrow: COLUMN_GROW,
      flexShrink: 0,
      alignItems: 'flex-end',
    },
    columnQuality: {
      width: COLUMN_WIDTHS.quality,
      flexGrow: COLUMN_GROW,
      flexShrink: 0,
      alignItems: 'flex-end',
    },
  });
}
