import { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { leagueNameWithoutRank, leagueRankFromTierName } from '../lib/league-rank';
import type { ClanMemberLeagueTier } from '../api/clan';

// The league rank cell content (07 section 4): the tier icon with the rank
// number beside it, the league moved up against the member the owner asked
// for. Both the roster table and the needs-attention table render the same
// cell, so the pair lives here instead of being drawn twice.
//
// The tier name ("Electro League 31") carries the rank as its trailing
// number; lib/league-rank.ts owns that parse. The league NAME itself stops
// being a visible column (the owner's call): the icon plus the number say
// what the game says at a glance, and the accessibility label still reads
// the league in full so a screen reader loses nothing.
//
// The icon slot is an API icon in a fixed 24 px box (07 section 7) so a
// slow CDN load never reflows the row; a member without a tier renders a
// quiet dash, never a broken-image glyph.

// The league icon slot (07 section 7): API icon in a fixed 24 px box.
const LEAGUE_ICON_SLOT = 24;

export interface LeagueRankProps {
  /** The member's ranked-ladder tier. Undefined for an unranked member. */
  tier?: ClanMemberLeagueTier;
}

export default function LeagueRank({ tier }: LeagueRankProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const rank = leagueRankFromTierName(tier?.name);
  const league = leagueNameWithoutRank(tier?.name);
  const icon = tier?.iconUrls?.small;
  const label = rank !== null && league !== '' ? `rank ${rank} in ${league}` : 'Unranked';

  if (rank === null) {
    // Unranked (or a tier name without a rank): the quiet dash. No icon
    // either, so the cell does not pretend to data it does not have.
    return (
      <View style={styles.cell} accessibilityLabel={label}>
        <Text style={styles.dash} aria-hidden>
          {'\u2014'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.cell} accessibilityLabel={label}>
      {icon ? (
        <Image source={{ uri: icon }} style={styles.icon} accessibilityLabel={`${league} league icon`} />
      ) : (
        <View style={styles.icon} />
      )}
      <Text style={styles.rank} numberOfLines={1}>
        {rank}
      </Text>
    </View>
  );
}

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    cell: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: t.spacing[2],
      minWidth: 0,
    },
    icon: {
      width: LEAGUE_ICON_SLOT,
      height: LEAGUE_ICON_SLOT,
    },
    rank: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    dash: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textMuted,
    },
  });
}
