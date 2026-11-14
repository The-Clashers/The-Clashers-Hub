import { useMemo } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { breakpointFor, createBaseStyles, useTheme } from '../theme';
import Breadcrumbs from '../components/Breadcrumbs';
import CompareMetricRows from '../components/CompareMetricRows';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import PillButton from '../components/PillButton';
import SkeletonBlock, { useSkeletonPulse } from '../components/SkeletonBlock';
import { fetchPlayer, PlayerFetchError, type PlayerResponse } from '../api/player';
import { busyRetryDelayMs, shouldRetryBusy } from '../lib/busy-retry';
import {
  computeRushed,
  playerToUnitEntries,
  RUSHED_CATEGORY_LABELS,
} from '../engines/rushed';
import {
  computePlayerCompare,
  type PlayerCompareSide,
} from '../engines/compare';
import { normalizeTagInput, playerRouteFor } from '../lib/tag';

// The player comparison screen (T-M3-3, FR-13, FR-14). The compare
// landing's "Compare Players" and the player card's "Compare this player"
// both land here, on the shareable /compare/players?a=TAG&b=TAG URL the
// feature list documents: two bare tags in the query string, canonicalized
// back through the one tag module so the fetches, the cache keys, and
// the identity cards all agree on #TAG.
//
// The screen owns the same fetch discipline the player detail keeps, one
// query per side, keyed the same way (['player', tag]) so a player the
// visitor just opened answers from the shared cache and the two layers
// of the same TTL decay together. The analysis boundary is the house
// rule: both payloads arrive, the rushed verdict for each side is
// computed here once, and the compare engine turns the two sides into
// metric rows (05 section 4). The engine owns every judgment; the screen
// never colors a value itself.
//
// The deliberate limitation is the screen's own subtitle: per-metric
// verdicts only, no single overall winner, because summing unlike units
// into one score is false precision (05 section 4). The identity cards
// ground the numbers (name, tag, Town Hall, league) without verdicts;
// the rows below carry them.

// The client staleTime mirrors the tier's 300 s player TTL (04 section 5)
// so the two cache layers decay together, the pairing every route keeps.
const PLAYER_STALE_TIME_MS = 300_000;

export default function PlayerCompareScreen() {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // The shareable URL's two bare tags, validated through the one tag
  // module. A missing or malformed side is a designed empty state, not
  // an error: the visitor may have hand-edited the address, and the fix
  // is the compare landing, not a retry.
  const tagA = normalizeTagInput(searchParams.get('a') ?? '');
  const tagB = normalizeTagInput(searchParams.get('b') ?? '');

  if (!tagA.ok || !tagB.ok) {
    return (
      <View style={base.appRoot}>
        <View style={base.screen}>
          <View style={[base.contentColumn, styles.column]}>
            <View style={styles.breadcrumbWrap}>
              <Breadcrumbs
                crumbs={[
                  { label: 'Home', route: '/' },
                  { label: 'Compare', route: '/compare' },
                  { label: 'Player comparison' },
                ]}
              />
            </View>
            <EmptyState
              title="Two player tags are needed"
              body="A player comparison reads /compare/players with two tags in the address bar, one after a= and one after b=. Pick both players on the compare screen instead."
              action={
                <PillButton
                  label="Choose players"
                  role="link"
                  arrow
                  onPress={() => navigate('/compare')}
                />
              }
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <PlayerCompareView tagA={tagA.tag} tagB={tagB.tag} />
  );
}

// ---------- the loaded screen ----------

interface PlayerCompareViewProps {
  tagA: string;
  tagB: string;
}

function PlayerCompareView({ tagA, tagB }: PlayerCompareViewProps) {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigate = useNavigate();

  // One query per side, the player detail's own key and retry policy so
  // the cache the visitor already holds answers here (04 section 5, 06
  // section 2): 404 and 400 are permanent for a hand-typed pair, busy
  // paces itself through lib/busy-retry, everything else one retry.
  const queryA = useQuery({
    queryKey: ['player', tagA] as const,
    queryFn: () => fetchPlayer(tagA),
    staleTime: PLAYER_STALE_TIME_MS,
    retry: (failureCount, error) => retryPolicy(failureCount, error),
    retryDelay: (failureCount, error) => retryDelay(failureCount, error),
  });
  const queryB = useQuery({
    queryKey: ['player', tagB] as const,
    queryFn: () => fetchPlayer(tagB),
    staleTime: PLAYER_STALE_TIME_MS,
    retry: (failureCount, error) => retryPolicy(failureCount, error),
    retryDelay: (failureCount, error) => retryDelay(failureCount, error),
  });

  const busyRetrying =
    (queryA.isPending &&
      queryA.failureReason instanceof PlayerFetchError &&
      queryA.failureReason.result.kind === 'busy') ||
    (queryB.isPending &&
      queryB.failureReason instanceof PlayerFetchError &&
      queryB.failureReason.result.kind === 'busy');

  // The first side that failed names the error panel; the comparison
  // cannot render without both profiles, so one panel says which half is
  // missing and offers the two fixes: retry, or pick a different pair.
  const failedQuery = queryA.isError ? queryA : queryB.isError ? queryB : null;
  const failedTag = queryA.isError ? tagA : tagB;

  return (
    <View style={base.appRoot}>
      <View style={base.screen}>
        <View style={[base.contentColumn, styles.column]}>
          <View style={styles.breadcrumbWrap}>
            <Breadcrumbs
              crumbs={[
                { label: 'Home', route: '/' },
                { label: 'Compare', route: '/compare' },
                { label: 'Player comparison' },
              ]}
            />
          </View>

          <View style={styles.header}>
            <Text style={base.display}>Player comparison</Text>
            <Text style={base.subtitle}>
              Side by side, metric by metric, with the better value colored on
              every row.
            </Text>
            <Text style={styles.noWinnerNote}>
              Per-metric verdicts only. There is no single overall winner:
              summing unlike units into one score is false precision.
            </Text>
          </View>

          {queryA.isPending || queryB.isPending ? (
            <CompareLoading busyRetrying={busyRetrying} />
          ) : failedQuery ? (
            <CompareError
              error={failedQuery.error as PlayerFetchError | Error}
              tag={failedTag}
              onRetry={() => void failedQuery.refetch()}
              isRetrying={failedQuery.isFetching}
              onPick={() => navigate('/compare')}
            />
          ) : (
            <CompareSuccess playerA={queryA.data!} playerB={queryB.data!} />
          )}
        </View>
      </View>
    </View>
  );
}

function retryPolicy(failureCount: number, error: unknown): boolean {
  if (error instanceof PlayerFetchError) {
    if (error.result.kind === 'not_found' || error.result.kind === 'bad_request') {
      return false;
    }
    if (error.result.kind === 'busy') {
      return shouldRetryBusy(failureCount);
    }
  }
  return failureCount < 1;
}

function retryDelay(failureCount: number, error: unknown): number {
  if (error instanceof PlayerFetchError && error.result.kind === 'busy') {
    return busyRetryDelayMs(error.result.retryAfter, failureCount);
  }
  return 1_000;
}

// ---------- success: identity cards + metric rows ----------

interface CompareSuccessProps {
  playerA: PlayerResponse;
  playerB: PlayerResponse;
}

function CompareSuccess({ playerA, playerB }: CompareSuccessProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Two-up from tablet up, stacked below it: the same breakpoint family
  // the standings cards and the roster's card switch keep (07 section 3),
  // read through useWindowDimensions, never CSS media queries.
  const { width } = useWindowDimensions();
  const twoUp = breakpointFor(width) === 'tablet' || breakpointFor(width) === 'desktop';

  // The rushed verdict per side, computed once here the same way the
  // player detail computes it (the adapter trues the payload into the
  // generic entries, the engine judges). The compare engine stays pure
  // on numbers: it never imports the rushed engine (05 section 5).
  const sideA = useMemo(() => playerToCompareSide(playerA), [playerA]);
  const sideB = useMemo(() => playerToCompareSide(playerB), [playerB]);

  const groups = useMemo(
    () => computePlayerCompare(sideA, sideB),
    [sideA, sideB],
  );

  return (
    <>
      <View style={twoUp ? styles.faceOffRow : styles.faceOffColumn}>
        <CompareSideCard side={sideA} player={playerA} sharesRow={twoUp} />
        <View style={twoUp ? styles.vsRow : styles.vsColumn} aria-hidden>
          <View style={styles.vsCircle}>
            <Text style={styles.vsText}>VS</Text>
          </View>
        </View>
        <CompareSideCard side={sideB} player={playerB} sharesRow={twoUp} />
      </View>
      <CompareMetricRows groups={groups} aName={sideA.name} bName={sideB.name} />
    </>
  );
}

// ---------- one side's identity card ----------

interface CompareSideCardProps {
  side: PlayerCompareSide;
  player: PlayerResponse;
  /** True when the card flexes to share the two-up row. */
  sharesRow: boolean;
}

function CompareSideCard({ side, player, sharesRow }: CompareSideCardProps) {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigate = useNavigate();

  // The identity header reads the ranked-ladder tier first and falls back
  // to the classic league object, the same order the player header keeps,
  // so the two league displays never disagree about which ladder they
  // show. A player with no league at all renders the quiet placeholder
  // slot and Unranked in the cell.
  const league = player.leagueTier ?? player.league;
  const leagueIconUri = league?.iconUrls?.small;

  const stats: ReadonlyArray<{ label: string; value: string }> = [
    { label: 'Town Hall', value: String(player.townHallLevel) },
    { label: 'XP level', value: String(player.expLevel) },
    { label: 'League', value: league?.name ?? 'Unranked' },
  ];

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${side.name}, Town Hall ${player.townHallLevel}, ${league?.name ?? 'Unranked'}. Opens the player's full profile.`}
      onPress={() => navigate(playerRouteFor(player.tag))}
      style={({ pressed }) => [
        base.panelRaised,
        styles.sideCard,
        sharesRow && styles.sideCardSharesRow,
        pressed && styles.sideCardPressed,
      ]}
    >
      <View style={styles.sideIdentity}>
        {leagueIconUri ? (
          <Image
            source={{ uri: leagueIconUri }}
            style={styles.leagueCrest}
            accessibilityLabel={`${league?.name ?? 'League'} crest`}
          />
        ) : (
          <View style={[styles.leagueCrest, styles.leagueCrestEmpty]} />
        )}
        <View style={styles.sideIdentityText}>
          <Text style={styles.sideName} numberOfLines={1}>
            {side.name}
          </Text>
          <View style={styles.sideMeta}>
            <Text style={styles.tagLine}>{player.tag}</Text>
            {player.clan ? (
              <>
                <Text style={styles.metaDot} aria-hidden>
                  |
                </Text>
                <Text style={styles.clanLine} numberOfLines={1}>
                  {player.clan.name}
                </Text>
              </>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.statRow}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.statCell}>
            <Text style={styles.statLabel}>{stat.label}</Text>
            <Text style={styles.statValue} numberOfLines={1}>
              {stat.value}
            </Text>
          </View>
        ))}
      </View>

      <Text style={styles.openProfile}>View full profile</Text>
    </Pressable>
  );
}

// ---------- the adapter: payload + verdict, into the engine's side ----------

/**
 * Trues one player payload plus her rushed verdict into the structural
 * side the compare engine consumes. This is the adapter's job the same
 * way the rushed adapter owns payload shapes (05 section 1 "Grouping is
 * an adapter's job"): the engine never sees a PlayerResponse.
 *
 * The heroes and achievements filter to the home village, the same
 * boundary the rushed analysis draws (builder-base content gets its own
 * panel there and no panel here). The optional counters pass through as
 * nulls, so a metric the payload cannot answer stays a dash instead of a
 * fake zero.
 */
function playerToCompareSide(player: PlayerResponse): PlayerCompareSide {
  const verdict = computeRushed(playerToUnitEntries(
    player.troops,
    player.spells,
    player.heroes,
    player.heroEquipment,
  ));

  return {
    name: player.name,
    tag: player.tag,
    townHallLevel: player.townHallLevel,
    expLevel: player.expLevel,
    warStars: player.warStars ?? null,
    attackWins: player.attackWins ?? null,
    rushedPercent: verdict.overallPercent,
    rushedCategories: verdict.categories.map((category) => ({
      label: RUSHED_CATEGORY_LABELS[category.category],
      percent: category.percent,
    })),
    heroes: (player.heroes ?? [])
      .filter((hero) => hero.village === 'home')
      .map((hero) => ({ name: hero.name, level: hero.level, maxLevel: hero.maxLevel })),
    achievements: (player.achievements ?? [])
      .filter((achievement) => achievement.village === 'home')
      .map((achievement) => ({
        name: achievement.name,
        stars: achievement.stars,
        value: achievement.value,
      })),
  };
}

// ---------- loading ----------

interface CompareLoadingProps {
  busyRetrying: boolean;
}

function CompareLoading({ busyRetrying }: CompareLoadingProps) {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const pulse = useSkeletonPulse();

  const { width } = useWindowDimensions();
  const twoUp = breakpointFor(width) === 'tablet' || breakpointFor(width) === 'desktop';

  return (
    <View style={twoUp ? styles.faceOffRow : styles.faceOffColumn} accessibilityLabel="Player comparison loading">
      {[0, 1].map((index) => (
        <View
          key={index}
          style={[base.panelRaised, styles.sideCard, twoUp && styles.sideCardSharesRow]}
        >
          <View style={styles.sideIdentity}>
            <SkeletonBlock width={24} height={24} pulse={pulse} radiusStep={1} />
            <View style={styles.sideIdentityText}>
              <SkeletonBlock width={160} height={theme.fontSize.md} pulse={pulse} />
              <SkeletonBlock width={120} height={theme.fontSize.xs} pulse={pulse} />
            </View>
          </View>
          <View style={styles.statRow}>
            {[0, 1, 2].map((cell) => (
              <SkeletonBlock key={cell} width="30%" height={theme.fontSize.lg} pulse={pulse} />
            ))}
          </View>
          {busyRetrying ? (
            <Text style={[base.caption, styles.loadingCaption]}>
              The game API is busy. One moment, retrying automatically…
            </Text>
          ) : null}
        </View>
      ))}
      <View style={styles.groupSkeleton} accessibilityLabel="Comparison rows loading">
        <View style={styles.groupSkeletonColumn}>
          {[0, 1, 2, 3, 4].map((line) => (
            <SkeletonBlock key={line} width="100%" height={theme.fontSize.body} pulse={pulse} />
          ))}
        </View>
      </View>
    </View>
  );
}

// ---------- error ----------

interface CompareErrorProps {
  error: PlayerFetchError | Error;
  tag: string;
  onRetry: () => void;
  isRetrying: boolean;
  onPick: () => void;
}

function CompareError({ error, tag, onRetry, isRetrying, onPick }: CompareErrorProps) {
  // The contract's four failure kinds, the player detail's own wording,
  // with the compare's own second action: picking a different pair is
  // the fix a stale tag needs, retry is the fix everything else does
  // (06 section 3, 04 section 6).
  if (error instanceof PlayerFetchError && error.result.kind === 'not_found') {
    return (
      <ErrorState
        tone="gone"
        title="No player with this tag"
        body={`The tag ${tag} on one side of the comparison did not resolve. The player left the game, or the tag has a typo: tags are 3 to 20 letters and numbers after the #. Pick a different player for that side.`}
        action={
          <PillButton label="Choose players" role="link" arrow onPress={onPick} />
        }
      />
    );
  }
  if (error instanceof PlayerFetchError && error.result.kind === 'busy') {
    return (
      <ErrorState
        tone="busy"
        title="The game API is busy"
        body={`Upstream answered 429 and automatic retries have not cleared it yet. Trying again now may work, or wait about ${error.result.retryAfter}s and retry.`}
        action={
          <PillButton
            label={isRetrying ? 'Retrying…' : 'Retry now'}
            onPress={onRetry}
            disabled={isRetrying}
          />
        }
      />
    );
  }
  if (error instanceof PlayerFetchError && error.result.kind === 'unreachable') {
    return (
      <ErrorState
        tone="gone"
        title="Can't reach the game API"
        body="The proxy or the game API did not answer. This is usually transient; retry in a moment."
        action={
          <PillButton
            label={isRetrying ? 'Retrying…' : 'Retry'}
            onPress={onRetry}
            disabled={isRetrying}
          />
        }
      />
    );
  }
  return (
    <ErrorState
      tone="gone"
      title="The tag is malformed"
      body={`One side of the comparison carries a tag the address bar cannot resolve (${tag}). Tags are 3 to 20 letters and numbers after the #. Pick both players on the compare screen instead.`}
      action={
        <PillButton label="Choose players" role="link" arrow onPress={onPick} />
      }
    />
  );
}

// ---------- styles ----------

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    column: {
      flex: 1,
    },
    breadcrumbWrap: {
      marginBottom: t.spacing[4],
    },
    header: {
      gap: t.spacing[2],
      marginBottom: t.spacing[5],
    },
    // The deliberate limitation as quiet copy under the subtitle, so the
    // absence of a winner banner reads as a decision, not an omission.
    noWinnerNote: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textMuted,
      lineHeight: t.lineHeight.normal * t.fontSize.sm,
    },

    // The face-off band: the two identity cards with the VS badge
    // between them, two-up from tablet (the standings' own family) and
    // stacked below it with the badge centered on its own row.
    faceOffRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      columnGap: t.spacing[3],
      marginBottom: t.spacing[5],
    },
    faceOffColumn: {
      gap: t.spacing[3],
      marginBottom: t.spacing[5],
    },
    vsRow: {
      alignSelf: 'center',
      paddingVertical: t.spacing[2],
    },
    vsColumn: {
      alignItems: 'center',
      paddingVertical: t.spacing[1],
    },
    vsCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.accentSoft,
      borderWidth: 1,
      borderColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    vsText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.bold,
      color: c.accentInk,
    },

    // One side's identity card: the roster card chrome (translucent
    // raised fill, glass top edge), a link to the player's full profile,
    // with focus and press states the kit's interactive pieces keep.
    sideCard: {
      gap: t.spacing[4],
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    sideCardSharesRow: {
      flex: 1,
      flexBasis: 0,
    },
    sideCardPressed: {
      backgroundColor: c.panel,
    },
    sideIdentity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing[3],
      minWidth: 0,
    },
    // The league crest's 24 px slot (07 section 7): API icon in a fixed
    // box so a slow CDN load never reflows the card.
    leagueCrest: {
      width: 24,
      height: 24,
      borderRadius: t.radius[1],
      backgroundColor: c.panel,
    },
    leagueCrestEmpty: {
      backgroundColor: c.hairline,
    },
    sideIdentityText: {
      flex: 1,
      minWidth: 0,
      gap: t.spacing[1],
    },
    sideName: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.md,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
    },
    sideMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      columnGap: t.spacing[2],
      rowGap: t.spacing[1],
    },
    tagLine: {
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.xs,
      color: c.textMuted,
    },
    metaDot: {
      fontSize: t.fontSize.xs,
      color: c.hairline,
    },
    clanLine: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      color: c.textSecondary,
      flexShrink: 1,
    },
    // The three context cells: the uniform label-above-value rhythm the
    // standings cards keep, tabular figures so both cards' columns align.
    statRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: t.spacing[5],
      rowGap: t.spacing[2],
    },
    statCell: {
      gap: t.spacing[1],
    },
    statLabel: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: t.letterSpacing.micro,
    },
    statValue: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    openProfile: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.accentInk,
      textTransform: 'uppercase',
      letterSpacing: t.letterSpacing.micro,
    },

    // The loading state's row-shape skeleton, matched to the group
    // panels it stands in for.
    groupSkeleton: {
      marginTop: t.spacing[2],
    },
    groupSkeletonColumn: {
      gap: t.spacing[2],
    },
    loadingCaption: {
      marginTop: t.spacing[1],
    },
  });
}
