import { useMemo } from 'react';
import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { breakpointFor, useTheme } from '../theme';
import Glyph from './Glyph';
import { formatWarPercent, leadingSide } from '../lib/war-standings';
import type { WarClan, WarState } from '../api/war';

// The current-war view's standings (T-M3-1, FR-10, the "both clans'
// stars + destruction" piece of the War tab design in 03 section 4): one
// card per side, badge and identity up top, the three numbers the game
// itself scores a war by underneath: stars, destruction, attacks used.
// The cards sit two-up from tablet up and stack below it, the same
// breakpoint the roster's table-to-card switch keeps (NFR-05's floor).
//
// The verdict chip is the view's one computed judgment (pillar 2,
// analysis, not just display): during battle day the leading side wears
// a gold "Leading" chip, and once the war ends the winner wears a green
// "Winner" chip, both resolved through lib/war-standings' leadingSide
// (the game's own stars-then-destruction rule). An even war or a
// preparation day that has not started wears no chip: there is nothing
// to say yet, and an invented leader would be a lie.
//
// Card chrome follows the roster cards (the peer surfaces): translucent
// panel-raised fill with the glass top edge but no backdrop blur, which
// the glass rules spend on the big surfaces only (07 section 2).

export interface WarStandingsProps {
  /** The viewed clan's side. */
  clan: WarClan;
  /** The opponent's side. */
  opponent: WarClan;
  /** The parsed war state; only inWar and ended carry a chip. */
  state: WarState | undefined;
  /** Attacks each side may use in total (teamSize x attacksPerMember),
   * when both are known; null renders the used count alone. */
  attacksAllowed: number | null;
}

/** The badge slot on the standings card (07 section 7): API icon in a
 * fixed box so a slow CDN load never reflows the card. */
const BADGE_SLOT = 40;

type StandingsChip = 'leading' | 'winner' | null;

function chipForSide(state: WarState | undefined, side: 'clan' | 'opponent', verdict: 'clan' | 'opponent' | 'tie'): StandingsChip {
  if (verdict !== side) return null;
  if (state === 'inWar') return 'leading';
  if (state === 'ended') return 'winner';
  return null;
}

interface WarClanCardProps {
  side: WarClan;
  chip: StandingsChip;
  attacksAllowed: number | null;
  /** True when the standings render two-up: the card flexes to share the
   * row. False on the stacked layout, where a zero flex basis would
   * collapse the card's height and pour its content over the neighbor. */
  sharesRow: boolean;
}

function WarClanCard({ side, chip, attacksAllowed, sharesRow }: WarClanCardProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const c = theme.colors;
  // A warless or degenerate side carries no name; the card still renders
  // (the numbers are the payload's own zeros) with an honest placeholder.
  const name = side.name !== '' ? side.name : 'Unknown clan';
  const attacks =
    attacksAllowed !== null ? `${side.attackCount} / ${attacksAllowed}` : String(side.attackCount);
  return (
    <View
      style={[styles.card, sharesRow && styles.cardSharesRow]}
      accessibilityLabel={`${name} standings: ${side.stars} stars, ${formatWarPercent(side.destructionPercentage)} destruction, ${attacks} attacks used`}
    >
      <View style={styles.headerRow}>
        {side.badgeUrl !== null ? (
          <Image
            source={{ uri: side.badgeUrl }}
            style={styles.badge}
            accessibilityLabel={`${name} clan badge`}
          />
        ) : (
          <View style={styles.badgePlaceholder} accessibilityLabel={`${name} clan badge`} />
        )}
        <View style={styles.identity}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.metaRow}>
            {side.tag !== '' ? <Text style={styles.tag}>{side.tag}</Text> : null}
            {side.tag !== '' ? (
              <Text style={styles.metaDot} aria-hidden>
                |
              </Text>
            ) : null}
            <Text style={styles.levelLine}>Level {side.clanLevel}</Text>
          </View>
        </View>
        {chip !== null ? (
          <View style={[styles.chip, chip === 'winner' ? styles.chipWinner : styles.chipLeading]}>
            <Text style={[styles.chipLabel, chip === 'winner' ? styles.chipLabelWinner : styles.chipLabelLeading]}>
              {chip === 'winner' ? 'Winner' : 'Leading'}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.divider} aria-hidden />

      <View style={styles.metricRow}>
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>Stars</Text>
          <View style={styles.metricValueRow}>
            <Glyph name="star" color={c.accent} />
            <Text style={styles.metricValue}>{side.stars}</Text>
          </View>
        </View>
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>Destruction</Text>
          <Text style={styles.metricValue}>{formatWarPercent(side.destructionPercentage)}</Text>
        </View>
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>Attacks</Text>
          <Text style={styles.metricValue}>{attacks}</Text>
        </View>
      </View>
    </View>
  );
}

export default function WarStandings({ clan, opponent, state, attacksAllowed }: WarStandingsProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  // Two-up from tablet up, stacked below it, read through the shared
  // breakpoint helper the roster's own switch uses (07 section 3).
  const { width } = useWindowDimensions();
  const twoUp = breakpointFor(width) === 'tablet' || breakpointFor(width) === 'desktop';

  const verdict = leadingSide(clan, opponent);

  return (
    <View style={twoUp ? styles.row : styles.column}>
      <WarClanCard
        side={clan}
        chip={chipForSide(state, 'clan', verdict)}
        attacksAllowed={attacksAllowed}
        sharesRow={twoUp}
      />
      <WarClanCard
        side={opponent}
        chip={chipForSide(state, 'opponent', verdict)}
        attacksAllowed={attacksAllowed}
        sharesRow={twoUp}
      />
    </View>
  );
}

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'stretch',
      columnGap: t.spacing[3],
    },
    column: {
      gap: t.spacing[3],
    },

    // The card chrome the roster cards keep: translucent raised fill,
    // glass top edge, no backdrop blur (the glass rules spend blur on the
    // big surfaces only). The row-sharing flex lives on cardSharesRow,
    // applied only in the two-up layout: a zero flex basis in the stacked
    // column layout collapses the card's height.
    card: {
      padding: t.spacing[3],
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorder,
      borderTopColor: c.panelHighlight,
      backgroundColor: c.panelRaised,
      minWidth: 0,
    },
    cardSharesRow: {
      flex: 1,
      flexBasis: 0,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: t.spacing[3],
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
    identity: {
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
      flexWrap: 'wrap',
      columnGap: t.spacing[2],
      rowGap: t.spacing[1],
    },
    tag: {
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.xs,
      color: c.textMuted,
    },
    metaDot: {
      fontSize: t.fontSize.xs,
      color: c.hairline,
    },
    levelLine: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.semibold,
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: t.letterSpacing.micro,
    },

    // The verdict chip: the RatioFlag's pill shape, soft fill with the
    // strong ink the soft pairs guarantee contrast for (07 section 2).
    chip: {
      borderRadius: t.radius.pill,
      paddingHorizontal: t.spacing[2],
      paddingVertical: t.spacing[1],
      flexShrink: 0,
    },
    chipLeading: {
      backgroundColor: c.accentSoft,
    },
    chipWinner: {
      backgroundColor: c.successSoft,
    },
    chipLabel: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.semibold,
      letterSpacing: t.letterSpacing.micro,
      textTransform: 'uppercase',
    },
    chipLabelLeading: {
      color: c.accentInk,
    },
    chipLabelWinner: {
      color: c.success,
    },

    divider: {
      height: 1,
      backgroundColor: c.hairline,
      marginVertical: t.spacing[3],
    },

    // The three standings metrics: the uniform label-above-value cells
    // the clan detail card's stat grid established, tabular figures so
    // the two cards' columns align across the row.
    metricRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: t.spacing[5],
      rowGap: t.spacing[2],
    },
    metricCell: {
      gap: t.spacing[1],
    },
    metricLabel: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: t.letterSpacing.micro,
    },
    metricValueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing[1],
    },
    metricValue: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
      fontVariant: ['tabular-nums'],
    },
  });
}
