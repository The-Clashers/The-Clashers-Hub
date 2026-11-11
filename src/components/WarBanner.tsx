import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createBaseStyles, useTheme } from '../theme';
import { formatWarClock, type WarVerdict } from '../lib/war-standings';
import type { WarState } from '../api/war';

// The current-war view's state banner (T-M3-1, FR-10, the "state banner"
// piece of the War tab design in 03 section 4). One quiet panel that
// answers the first question a war organizer has, "what state is the war
// in", before any number is read: preparation day, battle day, war
// ended, or no war at all, each with its own tone and support line.
//
// The shape follows the kit's state-panel rhythm (the ErrorState row): a
// tone dot beside a text column, headline over support. Tones carry
// meaning, not decoration: preparation is info blue, battle day is the
// one gold accent (the thing that matters is live), an ended war reads
// the verdict (success for a win, danger for a loss, muted for a tie)
// from the viewed clan's side, and no war stays muted. The verdict comes
// in as a prop from lib/war-standings (leadingSide, the game's own
// stars-then-destruction rule); the banner never computes it.
//
// The support line is built from fragments the payload actually carries
// (team size, the war clock), so a degenerate payload renders a complete
// sentence instead of an empty "vs" or a dangling "ends".

export interface WarBannerProps {
  /** The parsed war state; undefined reads as no war. */
  state: WarState | undefined;
  /** The viewed clan's name, from the clan fetch (a warless payload
   * carries none of its own). */
  clanName: string;
  /** The opponent's name when a war exists, null otherwise. */
  opponentName: string | null;
  /** Members per side, when the payload says. */
  teamSize?: number;
  /** When battle day starts (preparation's finish line). */
  startTimeMs?: number;
  /** When the war ends. */
  endTimeMs?: number;
  /** The standings verdict (leadingSide), or null when there is nothing
   * to compare yet. */
  verdict: WarVerdict | null;
}

// The tone dot's size, the ErrorState dot's own.
const DOT_SIZE = 10;

/** Joins the carried fragments with the quiet middot the kit's label
 * lines use; null when nothing carried, so the caller falls back to a
 * complete sentence. */
function joinSupport(fragments: ReadonlyArray<string | null>): string | null {
  const carried = fragments.filter((fragment): fragment is string => fragment !== null);
  return carried.length > 0 ? carried.join(' \u00B7 ') : null;
}

/** The support line under the headline: the facts the state carries. */
function warBannerSupport(props: WarBannerProps): string {
  const { state, clanName, opponentName, teamSize, startTimeMs, endTimeMs, verdict } = props;
  if (state === 'preparation') {
    return (
      joinSupport([
        teamSize !== undefined ? `${teamSize} vs ${teamSize}` : null,
        startTimeMs !== undefined ? `battle day starts ${formatWarClock(startTimeMs)}` : null,
      ]) ?? 'Bases are set; battle day is next.'
    );
  }
  if (state === 'inWar') {
    return (
      joinSupport([
        teamSize !== undefined ? `${teamSize} vs ${teamSize}` : null,
        endTimeMs !== undefined ? `ends ${formatWarClock(endTimeMs)}` : null,
      ]) ?? 'The war is live.'
    );
  }
  if (state === 'ended') {
    if (verdict === 'clan') return `${clanName} won this one.`;
    if (verdict === 'opponent') return `${opponentName ?? 'The opponent'} won this one.`;
    return 'It ended level: a tie.';
  }
  return `${clanName} is not in a war right now.`;
}

export default function WarBanner(props: WarBannerProps) {
  const { state, verdict } = props;
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const headline =
    state === 'preparation'
      ? 'Preparation day'
      : state === 'inWar'
        ? 'Battle day'
        : state === 'ended'
          ? 'War ended'
          : 'No war right now';

  const c = theme.colors;
  const tone =
    state === 'preparation'
      ? c.info
      : state === 'inWar'
        ? c.accent
        : state === 'ended'
          ? verdict === 'clan'
            ? c.success
            : verdict === 'opponent'
              ? c.danger
              : c.textMuted
          : c.textMuted;

  const support = warBannerSupport(props);

  return (
    <View
      style={base.panel}
      accessibilityLabel={`War state: ${headline}. ${support}`}
    >
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: tone }]} />
        <View style={styles.textColumn}>
          <Text style={base.title} accessibilityRole="header">
            {headline}
          </Text>
          <Text style={base.caption}>{support}</Text>
        </View>
      </View>
    </View>
  );
}

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    // The ErrorState's own row: dot beside the text column, so the two
    // state surfaces read as one family.
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: t.spacing[3],
    },
    dot: {
      width: DOT_SIZE,
      height: DOT_SIZE,
      borderRadius: t.radius.pill,
      marginTop: t.spacing[2],
    },
    textColumn: {
      flex: 1,
      gap: t.spacing[1],
      minWidth: 0,
    },
  });
}
