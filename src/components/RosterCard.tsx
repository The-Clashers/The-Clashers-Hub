import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import StatChip from './StatChip';
import { clanRoleLabel } from '../lib/clan-role';
import { linkEnterActivation } from '../lib/link-activation';
import type { ClanMember } from '../api/clan';

// The roster's card presentation (07 section 4), one card per member,
// rendered below 768 px (NFR-05). Same data and same columns as the table
// (RosterTable), stacked instead of side by side: name, role, and tag up
// top, the league line under it, then the sortable columns as the same
// label-above-value StatChips every other header in the app uses. The
// ratio chip moved to the Needs Attention tab with its own card
// (AttentionCard), so this card shows the plain roster. The granularity
// mirrors ClanCard (one item per component); the screen's card list owns
// the layout, which renders in page flow like the table does (07
// section 3): the browser scrollbar owns the scrolling.

// The league icon slot (07 section 7): API icon in a fixed 24 px box so a
// slow CDN load never reflows the card.
const LEAGUE_ICON_SLOT = 24;

export interface RosterCardProps {
  member: ClanMember;
  /** Fired with the member's tag when the card is tapped (FR-04). */
  onPress: (tag: string) => void;
}

export default function RosterCard({ member, onPress }: RosterCardProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const leagueName = member.leagueTier?.name ?? 'Unranked';
  const leagueIcon = member.leagueTier?.iconUrls?.small;
  // The whole card is the link, the same contract the table rows and the
  // search result cards use: the label reads the member, the hint says
  // where the tap goes.
  const cardLabel = `${member.name}, ${clanRoleLabel(member.role)}, town hall ${member.townHallLevel}, ${member.trophies} trophies, ${leagueName}, donated ${member.donations}, received ${member.donationsReceived}, experience level ${member.expLevel}`;
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
        <Text style={styles.name} numberOfLines={1}>
          {member.name}
        </Text>
        <Text style={styles.role} numberOfLines={1}>
          {clanRoleLabel(member.role)}
        </Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.tag} numberOfLines={1}>
          {member.tag}
        </Text>
        <View style={styles.leagueRow}>
          {leagueIcon ? (
            <Image
              source={{ uri: leagueIcon }}
              style={styles.leagueIcon}
              accessibilityLabel={`${leagueName} league icon`}
            />
          ) : (
            <View style={styles.leagueIcon} />
          )}
          <Text style={styles.leagueName} numberOfLines={1}>
            {leagueName}
          </Text>
        </View>
      </View>
      <View style={styles.statRow}>
        <StatChip label="TH" value={String(member.townHallLevel)} />
        <StatChip label="Trophies" value={String(member.trophies)} />
        <StatChip label="Donations" value={String(member.donations)} />
        <StatChip label="Received" value={String(member.donationsReceived)} />
        <StatChip label="XP" value={String(member.expLevel)} />
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
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: t.spacing[3],
    },
    name: {
      flexShrink: 1,
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.md,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
    },
    role: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textMuted,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: t.spacing[3],
      marginTop: t.spacing[1],
      marginBottom: t.spacing[3],
    },
    tag: {
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.xs,
      color: c.textMuted,
    },
    leagueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing[2],
    },
    leagueIcon: {
      width: LEAGUE_ICON_SLOT,
      height: LEAGUE_ICON_SLOT,
    },
    leagueName: {
      flexShrink: 1,
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textSecondary,
    },
    statRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: t.spacing[5],
      rowGap: t.spacing[2],
    },
  });
}
