import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import LeagueRank from './LeagueRank';
import RatioFlag from './RatioFlag';
import StatChip from './StatChip';
import { clanRoleLabel } from '../lib/clan-role';
import { linkEnterActivation } from '../lib/link-activation';
import type { DonationVerdict } from '../lib/donation-balance';
import type { ClanMember } from '../api/clan';

// The needs-attention card presentation (NFR-05), rendered below 768 px
// where the attention table's eight columns do not fit. Same data as the
// table, stacked: the number, rank, name, and role up top, the tag and
// the war-attacks line under it, then the donation columns and the ratio
// chip as the label-above-value StatChips every other card in the app
// uses. Cards render in page flow like the roster's cards (07 section 3).

export interface AttentionCardProps {
  member: ClanMember;
  /** 1-based position in the worst-first order. */
  position: number;
  /** The member's donation verdict from the balance engine. */
  verdict?: DonationVerdict;
  /** Attacks the member still holds in the current war, null for a dash. */
  attacksLeft: number | null;
  /** Fired with the member's tag when the card is tapped (FR-04). */
  onPress: (tag: string) => void;
}

export default function AttentionCard({
  member,
  position,
  verdict,
  attacksLeft,
  onPress,
}: AttentionCardProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const leagueName = member.leagueTier?.name ?? 'Unranked';
  // The whole card is the link, the same contract the roster cards and
  // the attention rows keep.
  const cardLabel = `Number ${position}, ${member.name}, ${clanRoleLabel(member.role)}, ${leagueName}, donated ${member.donations}, received ${member.donationsReceived}, ${attacksLeft !== null ? `${attacksLeft} war attacks left` : 'no war attack data'}`;
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
          <View style={styles.metaRow}>
            <LeagueRank tier={member.leagueTier} />
            <Text style={styles.tag} numberOfLines={1}>
              {member.tag}
            </Text>
          </View>
        </View>
        <Text style={styles.role} numberOfLines={1}>
          {clanRoleLabel(member.role)}
        </Text>
      </View>
      <View style={styles.statRow}>
        <StatChip label="Donated" value={String(member.donations)} />
        <StatChip label="Received" value={String(member.donationsReceived)} />
        <StatChip
          label="Attacks left"
          value={attacksLeft !== null ? String(attacksLeft) : '\u2014'}
        />
        {verdict ? <RatioFlag verdict={verdict} /> : null}
      </View>
    </Pressable>
  );
}

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    card: {
      padding: t.spacing[4],
      marginBottom: t.spacing[3],
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorder,
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
      marginBottom: t.spacing[3],
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
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: t.spacing[3],
      flexWrap: 'wrap',
    },
    tag: {
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.xs,
      color: c.textMuted,
    },
    role: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textMuted,
    },
    statRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: t.spacing[5],
      rowGap: t.spacing[2],
    },
  });
}
