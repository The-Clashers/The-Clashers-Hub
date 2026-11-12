import { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import ResultChip from './ResultChip';
import StatChip from './StatChip';
import { formatWarPercent } from '../lib/war-standings';
import { formatWarLogDate } from '../lib/war-efficiency';
import type { WarlogEntry } from '../api/warlog';

// The war log's card presentation (NFR-05), rendered below 768 px where
// the table's seven columns do not fit. Same data as the table,
// stacked: the result chip, the opponent badge and name, and the score
// as the label-above-value StatChips every other card in the app uses
// (the RosterCard, AttentionCard, and WarMemberCard pattern). Cards
// render in page flow like the roster's cards (07 section 3): the
// browser scrollbar owns the scrolling.

/** The opponent badge slot on the card title row. */
const BADGE_SLOT = 32;

export interface WarlogCardProps {
  entry: WarlogEntry;
}

export default function WarlogCard({ entry }: WarlogCardProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  // A league season carries no single opponent and its numbers
  // accumulate across seven rounds, so the card says what the season
  // honestly is — the totals, no opponent figures, no allowance — the
  // same calls the table row makes.
  const isLeague = entry.result === 'league';
  const opponentName = entry.opponent.name !== '' ? entry.opponent.name : 'Unknown clan';
  const allowed =
    entry.teamSize > 0 && entry.attacksPerMember > 0
      ? entry.teamSize * entry.attacksPerMember
      : null;
  const cardLabel = isLeague
    ? `League season, team size ${entry.teamSize}, ${entry.clan.attackCount} attacks, ${entry.clan.stars} stars, ${entry.endTimeMs !== undefined ? `ended ${formatWarLogDate(entry.endTimeMs)}` : 'end time unknown'}`
    : `${resultWord(entry.result)} against ${opponentName}, ${entry.clan.stars} to ${entry.opponent.stars} stars, ${formatWarPercent(entry.clan.destructionPercentage)} to ${formatWarPercent(entry.opponent.destructionPercentage)} destruction, ${allowed !== null ? `${entry.clan.attackCount} of ${allowed}` : entry.clan.attackCount} attacks, team size ${entry.teamSize}, ${entry.endTimeMs !== undefined ? `ended ${formatWarLogDate(entry.endTimeMs)}` : 'end time unknown'}`;
  return (
    <View style={styles.card} accessibilityLabel={cardLabel}>
      <View style={styles.titleRow}>
        <ResultChip result={entry.result} />
        {isLeague ? (
          <View style={styles.opponentCell}>
            <Text style={styles.seasonName} numberOfLines={1}>
              League season
            </Text>
          </View>
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
            <View style={styles.opponentIdentity}>
              <Text style={styles.opponentName} numberOfLines={1}>
                {opponentName}
              </Text>
              <Text style={styles.teamSizeLine} numberOfLines={1}>
                {entry.teamSize > 0 ? `${entry.teamSize}v${entry.teamSize} war` : 'War'}
              </Text>
            </View>
          </View>
        )}
      </View>
      <View style={styles.statRow}>
        <StatChip
          label="Stars"
          value={
            isLeague
              ? String(entry.clan.stars)
              : `${entry.clan.stars} \u2013 ${entry.opponent.stars}`
          }
        />
        {isLeague ? (
          <StatChip label="Attacks" value={String(entry.clan.attackCount)} />
        ) : (
          <>
            <StatChip
              label="Destruction"
              value={`${formatWarPercent(entry.clan.destructionPercentage)} \u2013 ${formatWarPercent(entry.opponent.destructionPercentage)}`}
            />
            <StatChip
              label="Attacks"
              value={
                allowed !== null
                  ? `${entry.clan.attackCount} / ${allowed}`
                  : String(entry.clan.attackCount)
              }
            />
          </>
        )}
        <StatChip
          label="Ended"
          value={entry.endTimeMs !== undefined ? formatWarLogDate(entry.endTimeMs) : '\u2014'}
        />
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

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    // The card chrome the roster and war member cards keep: translucent
    // raised fill, glass top edge, no backdrop blur.
    card: {
      padding: t.spacing[3],
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorder,
      borderTopColor: c.panelHighlight,
      backgroundColor: c.panelRaised,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing[3],
    },
    opponentCell: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing[2],
      flex: 1,
      minWidth: 0,
    },
    badge: {
      width: BADGE_SLOT,
      height: BADGE_SLOT,
      borderRadius: t.radius[2],
      backgroundColor: c.panel,
    },
    badgePlaceholder: {
      width: BADGE_SLOT,
      height: BADGE_SLOT,
      borderRadius: t.radius[2],
      backgroundColor: c.hairline,
    },
    opponentIdentity: {
      flex: 1,
      minWidth: 0,
      gap: t.spacing[1],
    },
    opponentName: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
    },
    // The league season's name cell, the table row's own quiet
    // description rather than an identity.
    seasonName: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textSecondary,
    },
    teamSizeLine: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      color: c.textMuted,
    },
    statRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: t.spacing[4],
      rowGap: t.spacing[2],
      marginTop: t.spacing[3],
    },
  });
}
