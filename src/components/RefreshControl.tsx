import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import PillButton from './PillButton';
import { cooldownRemainingSeconds, dataAgeHint } from '../lib/refresh';

// The manual refresh control (F-19 / FR-18, 07 section 4): the ghost pill
// button with the refresh glyph that re-issues the same GET, the 60 s
// cooldown that follows each use, and the data-age pill that says out loud
// when the tier answered from its cache instead of pretending the answer
// is fresh (06 section 2). The age pill is the prototype's cached pill: a
// quiet pill with the small success dot, the "Fetched just now" /
// "Cached, Ns ago" line riding in it—the small last-refresh text the
// owner asked to sit with the button.
//
// The control never decides freshness itself. The screen hands it the age
// the tier injected into the current response and the query's in-flight
// flag; the server's TTL is the only thing that chooses cache-hit versus
// upstream call, which is exactly the honesty the hint reports. Pressing
// it always re-issues the same GET (the query's refetch): inside the
// server TTL the answer comes back cached with its age, past it the tier
// makes its one upstream call.

export interface RefreshControlProps {
  /** Re-issues the same GET: the query's refetch, handed in so the
   * control stays rendering, not data-owning. */
  onRefresh: () => void;
  /** The age (seconds) the tier injected into the response on screen. */
  ageSeconds: number;
  /** True while that re-issued request is in flight, so a second press
   * cannot stack on the first. */
  isRefreshing: boolean;
  /** 'row' for horizontal (default), 'stacked' for vertical top-right placement. */
  layout?: 'row' | 'stacked';
}

// The cooldown countdown ticks once a second: the only clock the component
// keeps, and it exists purely to repaint the number.
const COOLDOWN_TICK_MS = 1000;

export default function RefreshControl({
  onRefresh,
  ageSeconds,
  isRefreshing,
  layout = 'row',
}: RefreshControlProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // The countdown is derived from the press timestamp on every tick, never
  // decremented: a hidden tab stalls the interval, and the first tick
  // after it returns corrects the number instead of letting it drift.
  const [lastUsedAt, setLastUsedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const remainingSeconds = lastUsedAt === null ? 0 : cooldownRemainingSeconds(lastUsedAt, now);
  const coolingDown = remainingSeconds > 0;

  useEffect(() => {
    if (!coolingDown) return;
    const tick = setInterval(() => setNow(Date.now()), COOLDOWN_TICK_MS);
    return () => clearInterval(tick);
  }, [coolingDown]);

  const handleRefresh = () => {
    const pressedAt = Date.now();
    setLastUsedAt(pressedAt);
    setNow(pressedAt);
    onRefresh();
  };

  // The label carries its own state: the countdown while cooling down (the
  // number is the affordance, a bare disabled button would read broken),
  // the in-flight note while the answer is on its way.
  const label = isRefreshing
    ? 'Refreshing…'
    : coolingDown
      ? `Refresh (${remainingSeconds}s)`
      : 'Refresh';

  if (layout === 'stacked') {
    return (
      <View style={styles.stackedWrap}>
        <PillButton
          label={label}
          variant="ghost"
          icon="refresh"
          onPress={handleRefresh}
          disabled={coolingDown || isRefreshing}
          hint="Sends the same request again. The server cache decides what comes back, and the button waits 60 seconds after each use."
        />
        <View style={styles.agePill}>
          <View style={styles.ageDot} aria-hidden />
          <Text style={styles.ageText}>{dataAgeHint(ageSeconds)}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <View style={styles.agePill}>
        <View style={styles.ageDot} aria-hidden />
        <Text style={styles.ageText}>{dataAgeHint(ageSeconds)}</Text>
      </View>
      <PillButton
        label={label}
        variant="ghost"
        icon="refresh"
        onPress={handleRefresh}
        disabled={coolingDown || isRefreshing}
        hint="Sends the same request again. The server cache decides what comes back, and the button waits 60 seconds after each use."
      />
    </View>
  );
}

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    stackedWrap: {
      alignItems: 'flex-end',
      gap: t.spacing[1],
    },
    // The freshness row: the age pill first, the action last, right where
    // each screen's age line used to sit. Wraps rather than squeezes when
    // a narrow phone runs out of room.
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      flexWrap: 'wrap',
      gap: t.spacing[3],
    },
    // The cached pill (the prototype's .cached-pill): the quiet pill the
    // last-refresh line rides in, with the small success dot saying the
    // answer is live through the tier. The pill takes the panel tone and
    // the hairline border so it reads as chrome, not as a chip with a
    // verdict.
    agePill: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: t.spacing[1],
      borderRadius: t.radius.pill,
      borderWidth: 1,
      borderColor: c.panelBorder,
      borderTopColor: c.panelHighlight,
      backgroundColor: c.panel,
      paddingHorizontal: t.spacing[2],
      paddingVertical: 2,
      minHeight: 22,
    },
    ageDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.success,
    },
    // The last-refresh line itself, in the caption voice with tabular
    // figures so the ticking seconds never jitter the pill's width.
    ageText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.regular,
      color: c.textMuted,
      fontVariant: ['tabular-nums'],
    },
  });
}
