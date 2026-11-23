import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { buildScoutingPairs, type ScoutingPair } from '../lib/war-scouting';
import { linkEnterActivation } from '../lib/link-activation';
import type { WarClan, WarMember } from '../api/war';

// Preparation-day scouting view (T-M3-6, FR-17, SR-18): own and
// opponent rosters side by side by war-map position, showing each
// member's Town Hall level and highlighting every pairing where the own
// member's Town Hall is strictly lower than the opponent's.
//
// Renders from the single /api/clan/:tag/war response (SR-18); both
// sides stay side by side down to the 360 px mobile floor by letting the
// two member columns flex from minWidth: 0 while the position, Town
// Hall, and mismatch delta slots keep compact fixed widths. Each
// populated member cell taps through to player detail, matching
// WarMemberTable's link behavior.

const POSITION_WIDTH = 32;
const TH_WIDTH = 46;
const DELTA_WIDTH = 36;
const MISMATCH_BORDER_WIDTH = 3;

export interface WarScoutingProps {
  /** The viewed clan's side of the war. */
  clan: WarClan;
  /** The opponent's side of the war. */
  opponent: WarClan;
  /** Fired with the member's tag when either side's member is tapped. */
  onPressMember: (tag: string) => void;
}

function townHallText(member: WarMember | null): string {
  if (member === null || member.townHallLevel <= 0) return '\u2014';
  return `TH ${member.townHallLevel}`;
}

function memberAccessibilityLabel(
  side: 'own' | 'opponent',
  pair: ScoutingPair,
  member: WarMember,
): string {
  const th = member.townHallLevel > 0 ? `Town Hall ${member.townHallLevel}` : 'unknown Town Hall';
  if (side === 'own' && pair.isMismatch && pair.opponent !== null) {
    return `Position ${pair.position}, ${member.name}, ${th}, mismatch against ${pair.opponent.name} at Town Hall ${pair.opponent.townHallLevel}`;
  }
  return `Position ${pair.position}, ${member.name}, ${th}`;
}

export default function WarScouting({ clan, opponent, onPressMember }: WarScoutingProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const ownLabel = clan.name !== '' ? clan.name : 'Clan';
  const opponentLabel = opponent.name !== '' ? opponent.name : 'Opponent';
  const { pairs, mismatchCount } = useMemo(
    () => buildScoutingPairs(clan.members, opponent.members),
    [clan.members, opponent.members],
  );

  if (pairs.length === 0) {
    return (
      <Text style={styles.emptyNote}>
        War rosters did not come back with the war data.
      </Text>
    );
  }

  const mismatchSummary =
    mismatchCount === 0
      ? 'No TH mismatches'
      : mismatchCount === 1
        ? '1 TH mismatch'
        : `${mismatchCount} TH mismatches`;

  return (
    <View style={styles.section}>
      <View style={styles.headerBar}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Preparation scouting</Text>
          <Text style={styles.subtitle}>
            Pairwise Town Hall matchups by war map position
          </Text>
        </View>
        <View
          style={[
            styles.summaryChip,
            mismatchCount > 0 ? styles.summaryChipWarn : styles.summaryChipClear,
          ]}
          accessibilityLabel={mismatchSummary}
        >
          <Text
            style={[
              styles.summaryChipText,
              mismatchCount > 0 ? styles.summaryChipTextWarn : styles.summaryChipTextClear,
            ]}
            numberOfLines={1}
          >
            {mismatchSummary}
          </Text>
        </View>
      </View>

      <View
        accessibilityRole="grid"
        accessibilityLabel={`${ownLabel} versus ${opponentLabel} preparation scouting`}
        style={styles.table}
      >
        <View accessibilityRole="row" style={styles.tableHeaderRow}>
          <View accessibilityRole="columnheader" style={styles.positionCol}>
            <Text style={[styles.colHeaderText, styles.alignRight]}>#</Text>
          </View>
          <View accessibilityRole="columnheader" style={styles.memberCol}>
            <Text style={styles.colHeaderText} numberOfLines={1}>
              {ownLabel}
            </Text>
          </View>
          <View accessibilityRole="columnheader" style={styles.thCol}>
            <Text style={[styles.colHeaderText, styles.alignRight]}>TH</Text>
          </View>
          <View accessibilityRole="columnheader" style={styles.deltaCol}>
            <Text style={[styles.colHeaderText, styles.alignCenter]}>Diff</Text>
          </View>
          <View accessibilityRole="columnheader" style={styles.thCol}>
            <Text style={[styles.colHeaderText, styles.alignLeft]}>TH</Text>
          </View>
          <View accessibilityRole="columnheader" style={styles.memberCol}>
            <Text style={[styles.colHeaderText, styles.alignRight]} numberOfLines={1}>
              {opponentLabel}
            </Text>
          </View>
        </View>

        {pairs.map((pair, index) => (
          <ScoutingRow
            key={pair.key}
            pair={pair}
            isLast={index === pairs.length - 1}
            onPressMember={onPressMember}
            styles={styles}
          />
        ))}
      </View>
    </View>
  );
}

interface ScoutingRowProps {
  pair: ScoutingPair;
  isLast: boolean;
  onPressMember: (tag: string) => void;
  styles: ReturnType<typeof createStyles>;
}

function ScoutingRow({ pair, isLast, onPressMember, styles }: ScoutingRowProps) {
  const { own, opponent, isMismatch, townHallDelta, position } = pair;
  const rowLabel = `Position ${position}: ${own ? `${own.name} ${townHallText(own)}` : 'open slot'} versus ${opponent ? `${opponent.name} ${townHallText(opponent)}` : 'open slot'}${isMismatch ? `, mismatch by ${townHallDelta} Town Hall` : ''}`;

  return (
    <View
      accessibilityRole="row"
      accessibilityLabel={rowLabel}
      style={[
        styles.row,
        !isLast && styles.rowBorder,
        isMismatch && styles.rowMismatch,
      ]}
    >
      <View style={styles.positionCol}>
        <Text style={styles.positionText}>{position}</Text>
      </View>

      <View style={styles.memberCol}>
        {own !== null ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={memberAccessibilityLabel('own', pair, own)}
            accessibilityHint="Opens this member's player detail screen."
            onPress={() => onPressMember(own.tag)}
            onKeyDown={linkEnterActivation(() => onPressMember(own.tag))}
            style={({ pressed }) => [styles.memberLink, pressed && styles.memberLinkPressed]}
          >
            <Text style={styles.memberName} numberOfLines={1}>
              {own.name}
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.missingText}>{'\u2014'}</Text>
        )}
      </View>

      <View style={styles.thCol}>
        <Text
          style={[
            styles.thText,
            styles.alignRight,
            isMismatch && styles.thTextMismatch,
          ]}
          numberOfLines={1}
        >
          {townHallText(own)}
        </Text>
      </View>

      <View style={styles.deltaCol}>
        {isMismatch ? (
          <View style={styles.deltaBadge}>
            <Text style={styles.deltaBadgeText} numberOfLines={1}>
              +{townHallDelta}
            </Text>
          </View>
        ) : (
          <Text style={[styles.deltaQuiet, styles.alignCenter]}>{'\u2014'}</Text>
        )}
      </View>

      <View style={styles.thCol}>
        <Text style={[styles.thText, styles.alignLeft]} numberOfLines={1}>
          {townHallText(opponent)}
        </Text>
      </View>

      <View style={styles.memberCol}>
        {opponent !== null ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={memberAccessibilityLabel('opponent', pair, opponent)}
            accessibilityHint="Opens this member's player detail screen."
            onPress={() => onPressMember(opponent.tag)}
            onKeyDown={linkEnterActivation(() => onPressMember(opponent.tag))}
            style={({ pressed }) => [
              styles.memberLink,
              styles.memberLinkRight,
              pressed && styles.memberLinkPressed,
            ]}
          >
            <Text style={[styles.memberName, styles.alignRight]} numberOfLines={1}>
              {opponent.name}
            </Text>
          </Pressable>
        ) : (
          <Text style={[styles.missingText, styles.alignRight]}>{'\u2014'}</Text>
        )}
      </View>
    </View>
  );
}

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    section: {
      gap: t.spacing[3],
    },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: t.spacing[2],
    },
    titleBlock: {
      flexShrink: 1,
      minWidth: 0,
      gap: t.spacing[1],
    },
    title: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.md,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
    },
    subtitle: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      color: c.textMuted,
    },
    summaryChip: {
      paddingHorizontal: t.spacing[2],
      paddingVertical: t.spacing[1],
      borderRadius: t.radius.pill,
      borderWidth: 1,
    },
    summaryChipWarn: {
      backgroundColor: c.warningSoft,
      borderColor: c.warning,
    },
    summaryChipClear: {
      backgroundColor: c.successSoft,
      borderColor: c.success,
    },
    summaryChipText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.semibold,
      fontVariant: ['tabular-nums'],
    },
    summaryChipTextWarn: {
      color: c.warning,
    },
    summaryChipTextClear: {
      color: c.success,
    },
    table: {
      backgroundColor: c.panelRaised,
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorder,
      borderTopColor: c.panelHighlight,
      overflow: 'hidden',
    },
    tableHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: t.layout.controlHeight,
      paddingHorizontal: t.spacing[3],
      columnGap: t.spacing[2],
      borderBottomWidth: 1,
      borderBottomColor: c.panelBorder,
      backgroundColor: c.panel,
    },
    colHeaderText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: t.letterSpacing.micro,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: t.layout.controlHeight,
      paddingHorizontal: t.spacing[3],
      paddingVertical: t.spacing[2],
      columnGap: t.spacing[2],
    },
    rowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: c.hairline,
    },
    // Highlight rows where the own member faces a higher-TH opponent.
    rowMismatch: {
      backgroundColor: c.warningSoft,
      borderLeftWidth: MISMATCH_BORDER_WIDTH,
      borderLeftColor: c.warning,
    },
    positionCol: {
      width: POSITION_WIDTH,
    },
    memberCol: {
      flex: 1,
      minWidth: 0,
    },
    thCol: {
      width: TH_WIDTH,
    },
    deltaCol: {
      width: DELTA_WIDTH,
      alignItems: 'center',
    },
    positionText: {
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.xs,
      color: c.textMuted,
      fontVariant: ['tabular-nums'],
      textAlign: 'right',
    },
    memberLink: {
      paddingVertical: t.spacing[1],
      borderRadius: t.radius[1],
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    memberLinkRight: {
      alignItems: 'flex-end',
    },
    memberLinkPressed: {
      opacity: 0.72,
    },
    memberName: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.medium,
      color: c.textPrimary,
    },
    thText: {
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.semibold,
      color: c.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    thTextMismatch: {
      color: c.warning,
    },
    deltaBadge: {
      paddingHorizontal: t.spacing[1],
      paddingVertical: 2,
      borderRadius: t.radius[1],
      backgroundColor: c.warning,
    },
    deltaBadgeText: {
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.semibold,
      color: c.textInverse,
      fontVariant: ['tabular-nums'],
    },
    deltaQuiet: {
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.xs,
      color: c.textMuted,
    },
    missingText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textMuted,
    },
    emptyNote: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textMuted,
    },
    alignLeft: {
      textAlign: 'left',
    },
    alignCenter: {
      textAlign: 'center',
    },
    alignRight: {
      textAlign: 'right',
    },
  });
}
