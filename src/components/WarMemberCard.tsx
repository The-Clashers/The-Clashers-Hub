import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import StatChip from './StatChip';
import {
  formatWarPercent,
  memberAverageDestruction,
  memberStars,
} from '../lib/war-standings';
import { linkEnterActivation } from '../lib/link-activation';
import type { WarMember } from '../api/war';

// The war roster's card presentation (NFR-05), rendered below 768 px
// where the table's six columns do not fit. Same data as the table,
// stacked: the map position, name, and Town Hall up top, the tag under
// it, then the three war columns as the label-above-value StatChips
// every other card in the app uses (the RosterCard and AttentionCard
// pattern). Cards render in page flow like the roster's cards (07
// section 3): the browser scrollbar owns the scrolling.

export interface WarMemberCardProps {
  member: WarMember;
  /** 1-based map position, or the payload index when the map did not
   * say; owned by the caller so the table and card agree. */
  position: number;
  /** Attacks each member may use, when the payload says. */
  attacksPerMember?: number;
  /** Fired with the member's tag when the card is tapped. */
  onPress: (tag: string) => void;
}

export default function WarMemberCard({
  member,
  position,
  attacksPerMember,
  onPress,
}: WarMemberCardProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const stars = memberStars(member);
  const averageDestruction = memberAverageDestruction(member);
  const used = member.attacks.length;
  // The whole card is the link, the same contract the roster cards, the
  // attention cards, and the war table rows keep.
  const cardLabel = `Position ${position}, ${member.name}, town hall ${member.townHallLevel}, ${attacksPerMember !== undefined ? `${used} of ${attacksPerMember}` : used} attacks used, ${stars} stars, ${averageDestruction !== null ? `${formatWarPercent(averageDestruction)} average destruction` : 'no attacks yet'}`;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={cardLabel}
      accessibilityHint="Opens this member's player detail screen."
      onPress={() => onPress(member.tag)}
      onKeyDown={linkEnterActivation(() => onPress(member.tag))}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.titleRow}>
        <Text style={styles.positionNumber}>#{position}</Text>
        <View style={styles.titleMiddle}>
          <Text style={styles.name} numberOfLines={1}>
            {member.name}
          </Text>
          <Text style={styles.tag} numberOfLines={1}>
            {member.tag}
          </Text>
        </View>
        <Text style={styles.townHall} numberOfLines={1}>
          TH {member.townHallLevel}
        </Text>
      </View>
      <View style={styles.statRow}>
        <StatChip
          label="Attacks"
          value={attacksPerMember !== undefined ? `${used} / ${attacksPerMember}` : String(used)}
        />
        <StatChip label="Stars" value={String(stars)} />
        <StatChip
          label="Destruction"
          value={averageDestruction !== null ? formatWarPercent(averageDestruction) : '\u2014'}
        />
      </View>
    </Pressable>
  );
}

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    // The card chrome the roster and attention cards keep.
    card: {
      padding: t.spacing[3],
      marginBottom: t.spacing[2],
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorder,
      borderTopColor: c.panelHighlight,
      backgroundColor: c.panelRaised,
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    cardPressed: {
      backgroundColor: c.panel,
      borderColor: c.panelBorderStrong,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      columnGap: t.spacing[3],
      marginBottom: t.spacing[2],
    },
    positionNumber: {
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.sm,
      color: c.textMuted,
      fontVariant: ['tabular-nums'],
      paddingTop: 2,
    },
    titleMiddle: {
      flex: 1,
      minWidth: 0,
      gap: t.spacing[1],
    },
    name: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.md,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
    },
    tag: {
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.xs,
      color: c.textMuted,
    },
    townHall: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textMuted,
      fontVariant: ['tabular-nums'],
    },
    statRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: t.spacing[5],
      rowGap: t.spacing[2],
    },
  });
}
