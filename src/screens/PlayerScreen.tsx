import { useMemo } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTheme, createBaseStyles, breakpointFor } from '../theme';
import Breadcrumbs from '../components/Breadcrumbs';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import PillButton from '../components/PillButton';
import SkeletonBlock, { useSkeletonPulse } from '../components/SkeletonBlock';
import { fetchPlayer, PlayerFetchError, type PlayerResponse } from '../api/player';
import { busyRetryDelayMs, shouldRetryBusy } from '../lib/busy-retry';
import { clanRoleLabel } from '../lib/clan-role';
import { canonicalTagFromRoute } from '../lib/tag';

// The player detail shell (T-M2-1, FR-06, FR-14). The roster's tap-through
// and the tag boxes both land here (golden paths A and B), on the shareable
// /player/:tag URL the route map documents. The shell owns the fetch and its
// states and lays out the page the design language fixes: two columns from
// 1024 px up (identity + analysis), stacked below it.
//
// The identity card carries the FR-06 header: the name, the tag with the
// clan name beside it, then the stat cells (Town Hall, league, XP level,
// clan role). The league cell reads the ranked-ladder tier (leagueTier, the
// same field the roster's rank column reads) with its icon in the 24 px
// slot, falling back to the classic league object when the payload carries
// no tier, so the site's two league displays never disagree about which
// ladder they show. The role label comes from lib/clan-role.ts, the one
// table the roster reads, so "admin" says Elder here too.
//
// The analysis column holds the three sections the M2 cards will fill
// (rushed analysis, heroes, achievements). Until they ship, each section
// renders the designed land-in-M2 notice, the same shape the clan screen's
// War and Log tabs carry: titled, explained, pointing at the card that
// fills it, so the screen reads end to end today and a reviewer knows what
// is missing by design rather than by oversight.
//
// Breadcrumbs locate the page the way the clan detail's do (07 section 3):
// Home > Players > <player name>, the tag from the URL until the name is in
// hand so the trail is layout-stable through the loading state. The route
// param carries the bare tag (shareable URLs carry no #, see lib/tag.ts),
// canonicalized back through the tag module so the fetch, the cache key,
// and the on-screen tag all agree on #TAG.

// The client staleTime mirrors the tier's 300 s player TTL (04 section 5) so
// the two cache layers decay together, the same pairing every route keeps.
const PLAYER_STALE_TIME_MS = 300_000;

// The league icon slot (07 section 7): API icon in a fixed 24 px box, so a
// slow CDN load never reflows the stat grid.
const LEAGUE_ICON_SLOT = 24;

// Line widths chosen to read as a name and a tag line; the stat cells mirror
// the uniform grid they stand in for.
const SKELETON_NAME_WIDTH = 200;
const SKELETON_META_WIDTH = 170;

// The header stat cells the skeleton draws, matching the grid's count.
const SKELETON_STAT_CELLS = 4;

// The analysis sections the skeleton draws, matching the three land-in-M2
// notices the success state renders.
const SKELETON_SECTIONS = 3;

// Micro-label tracking: the one-off 0.6 px tracking the design language
// pairs with uppercase micro labels (StatChip keeps the same local value).
// It becomes a token the moment a second value needs one.
const LABEL_TRACKING = 0.6;

export default function PlayerScreen() {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const params = useParams();
  const navigate = useNavigate();

  const tag = canonicalTagFromRoute(params.tag ?? '');

  const query = useQuery({
    queryKey: ['player', tag] as const,
    queryFn: () => fetchPlayer(tag),
    staleTime: PLAYER_STALE_TIME_MS,
    retry: (failureCount, error) => {
      // A 404 is permanent for a tag the user navigated to (the player left
      // the game or the URL is stale); retrying burns no upstream calls
      // thanks to the 30 s negative cache, but it cannot fix anything, so
      // we stop. A 400 is our URL being wrong; retrying the same request
      // cannot fix it. The busy outcome auto-retries with backoff (06
      // section 3): the tier already retried the throttle itself, so the
      // client paces itself through lib/busy-retry and the screen keeps
      // its skeleton with a "one moment" note instead of flipping to an
      // error screen. Everything else gets the single default retry.
      if (error instanceof PlayerFetchError) {
        if (error.result.kind === 'not_found' || error.result.kind === 'bad_request') {
          return false;
        }
        if (error.result.kind === 'busy') {
          return shouldRetryBusy(failureCount);
        }
      }
      return failureCount < 1;
    },
    retryDelay: (failureCount, error) => {
      if (error instanceof PlayerFetchError && error.result.kind === 'busy') {
        return busyRetryDelayMs(error.result.retryAfter, failureCount);
      }
      // Only the single default retry ever waits on this: the library's
      // own first backoff.
      return 1_000;
    },
  });

  // True while the first load is auto-retrying a busy answer: the skeleton
  // stays up and its caption switches to the "one moment" note (06
  // section 3), so a throttled demo reads as a slow fetch, not an error.
  const busyRetrying =
    query.isPending &&
    query.failureReason instanceof PlayerFetchError &&
    query.failureReason.result.kind === 'busy';

  // The breadcrumb's current crumb: the player name once it is in hand, the
  // tag from the URL until then (and on error), which keeps the trail
  // layout-stable through the loading state.
  const currentCrumb = query.data?.name ?? tag;

  return (
    <View style={base.appRoot}>
      <View style={base.screen}>
        <View style={[base.contentColumn, styles.column]}>
          <View style={styles.breadcrumbWrap}>
            <Breadcrumbs
              crumbs={[
                { label: 'Home', route: '/' },
                { label: 'Players', route: '/players' },
                { label: currentCrumb },
              ]}
            />
          </View>

          {query.isPending ? (
            <PlayerLoading busyRetrying={busyRetrying} />
          ) : query.isError ? (
            <View style={[base.panelRaised, styles.detailPanel]}>
              <PlayerError
                error={query.error as PlayerFetchError | Error}
                onRetry={() => void query.refetch()}
                onLookup={() => navigate('/players')}
                isRetrying={query.isFetching}
                tag={tag}
              />
            </View>
          ) : (
            <PlayerSuccess player={query.data} />
          )}

          <View style={styles.footer}>
            {query.isSuccess ? (
              <Text style={base.caption}>fetched {query.data.age}s ago</Text>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

// ---------- success: identity card + analysis sections ----------

interface PlayerSuccessProps {
  player: PlayerResponse;
}

function PlayerSuccess({ player }: PlayerSuccessProps) {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);

  // The two-column rule (07 section 3): identity + analysis from 1024 px up,
  // stacked below it. Read through useWindowDimensions into the breakpoints
  // helper, never CSS media queries.
  const { width } = useWindowDimensions();
  const breakpoint = breakpointFor(width);
  const twoColumns = breakpoint === 'desktop';

  // The header reads the ranked-ladder tier (the same field the roster's
  // rank column reads) and falls back to the classic league object when the
  // payload carries no tier, so the player header and the roster never
  // disagree about which ladder they show.
  const league = player.leagueTier ?? player.league;

  // The FR-06 header cells. The values speak (tabular figures), the labels
  // whisper, the same rhythm the clan detail card's stat grid keeps. The
  // league cell pairs the tier icon with the tier name; a clanless player
  // renders the quiet dash in the clan role cell, and a player with no
  // league at all renders Unranked as text.
  const stats: ReadonlyArray<HeaderStat> = [
    { label: 'Town Hall', value: String(player.townHallLevel) },
    { label: 'League', value: league?.name ?? 'Unranked', iconUri: league?.iconUrls?.small },
    { label: 'XP level', value: String(player.expLevel) },
    { label: 'Clan role', value: player.role ? clanRoleLabel(player.role) : '\u2014' },
  ];

  // The stat grid wraps two cells per row inside the identity column (the
  // column the two-column layout gives the card is too narrow for four),
  // and follows the clan card's own rule when the card runs full width:
  // four per row from tablet up, two below.
  const cellBasis = twoColumns || breakpoint === 'mobile' || breakpoint === 'small'
    ? styles.statCellHalf
    : styles.statCellQuarter;

  const identityCard = (
    <View
      style={[base.panelRaised, styles.identityCard]}
      accessibilityLabel={`${player.name} player detail`}
    >
      <View style={styles.identityText}>
        <Text style={base.title} numberOfLines={1}>
          {player.name}
        </Text>
        <View style={styles.identityMeta}>
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

      <View style={styles.statDivider} aria-hidden />

      <View style={styles.statGrid}>
        {stats.map((stat) => (
          <View key={stat.label} style={[styles.statCell, cellBasis]}>
            <Text style={styles.statLabel}>{stat.label}</Text>
            {stat.iconUri ? (
              <View style={styles.statValueRow}>
                <Image
                  source={{ uri: stat.iconUri }}
                  style={styles.leagueIcon}
                  accessibilityLabel={`${stat.value} league icon`}
                />
                <Text style={styles.statValue} numberOfLines={1}>
                  {stat.value}
                </Text>
              </View>
            ) : (
              <Text style={styles.statValue} numberOfLines={1}>
                {stat.value}
              </Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );

  const sections = (
    <>
      <EmptyState
        title="Rushed analysis lands with the M2 engine"
        body="The overall rushed gauge, the per-category bars, and the top-deficit list render here once the rushed engine card (T-M2-2) ships."
      />
      <EmptyState
        title="Hero panel lands in M2"
        body="Hero levels versus maximum, and equipment where the game API exposes it, render here with the hero card (T-M2-4)."
      />
      <EmptyState
        title="Achievements land in M2"
        body="The achievements list with progress rails and stars renders here with the achievements card (T-M2-3)."
      />
    </>
  );

  return twoColumns ? (
    <View style={styles.columns}>
      <View style={styles.identityColumn}>{identityCard}</View>
      <View style={styles.analysisColumn}>{sections}</View>
    </View>
  ) : (
    <View style={styles.stackedColumn}>
      {identityCard}
      <View style={styles.sectionStack}>{sections}</View>
    </View>
  );
}

/** One header stat cell: a label, a value, and (the league cell only) the
 * API icon that pairs with the value. */
interface HeaderStat {
  label: string;
  value: string;
  iconUri?: string;
}

// ---------- loading skeleton (06 section 3) ----------

interface PlayerLoadingProps {
  /** True while a busy answer is being auto-retried; swaps the caption to
   * the "one moment" note so a throttled upstream reads as a slow fetch. */
  busyRetrying: boolean;
}

// The skeleton mirrors the whole success layout, not just the identity
// card: without the analysis sections' shapes below, the first paint would
// hold only the header's height and the page would visibly grow and reflow
// the moment data landed (the layout-matched rule, 06 section 3). Every
// size here mirrors a real element; if the success layout changes, this
// follows in the same PR.
function PlayerLoading({ busyRetrying }: PlayerLoadingProps) {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const pulse = useSkeletonPulse();

  const { width } = useWindowDimensions();
  const breakpoint = breakpointFor(width);
  const twoColumns = breakpoint === 'desktop';
  const cellBasis = twoColumns || breakpoint === 'mobile' || breakpoint === 'small'
    ? styles.statCellHalf
    : styles.statCellQuarter;

  const identityCard = (
    <View
      style={[base.panelRaised, styles.identityCard]}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading player"
    >
      <View style={styles.identityText}>
        <SkeletonBlock width={SKELETON_NAME_WIDTH} height={theme.fontSize.xl} pulse={pulse} />
        <SkeletonBlock width={SKELETON_META_WIDTH} height={theme.fontSize.xs} pulse={pulse} />
      </View>
      <View style={styles.statDivider} aria-hidden />
      <View style={styles.statGrid}>
        {Array.from({ length: SKELETON_STAT_CELLS }, (_, index) => (
          <View key={index} style={[styles.statCell, cellBasis]}>
            <SkeletonBlock width="70%" height={theme.fontSize.xs} pulse={pulse} />
            <SkeletonBlock width="50%" height={theme.fontSize.sm} pulse={pulse} />
          </View>
        ))}
      </View>
      <Text style={[base.caption, styles.loadingCaption]}>
        {busyRetrying
          ? 'The game API is busy. One moment, retrying automatically…'
          : 'Fetching through the tier…'}
      </Text>
    </View>
  );

  const sections = (
    <>
      {Array.from({ length: SKELETON_SECTIONS }, (_, index) => (
        // Each block mirrors the EmptyState notice it stands in for: the
        // shared state panel with a title line and a body line.
        <View key={index} style={base.statePanel}>
          <SkeletonBlock width="55%" height={theme.fontSize.xl} pulse={pulse} />
          <SkeletonBlock width="92%" height={theme.fontSize.body} pulse={pulse} />
        </View>
      ))}
    </>
  );

  return twoColumns ? (
    <View style={styles.columns}>
      <View style={styles.identityColumn}>{identityCard}</View>
      <View style={styles.analysisColumn} aria-hidden>
        {sections}
      </View>
    </View>
  ) : (
    <View style={styles.stackedColumn}>
      {identityCard}
      <View style={styles.sectionStack} aria-hidden>
        {sections}
      </View>
    </View>
  );
}

// ---------- error ----------

interface PlayerErrorProps {
  error: PlayerFetchError | Error;
  onRetry: () => void;
  onLookup: () => void;
  isRetrying: boolean;
  tag: string;
}

function PlayerError({ error, onRetry, onLookup, isRetrying, tag }: PlayerErrorProps) {
  // The contract (04 section 6) gives the player route the same four real
  // states the clan route has. Each gets its own copy and a next action,
  // never a dead end (06 section 3). The retry action is shared; the
  // not_found branch surfaces "tag lookup" as its own primary action since
  // retry cannot fix a tag that no longer resolves, and its body carries
  // the tag-correction hint the state matrix asks for: what a well-formed
  // tag looks like, so a typo'd URL can be fixed by hand.
  if (error instanceof PlayerFetchError) {
    const result = error.result;
    if (result.kind === 'not_found') {
      return (
        <ErrorState
          tone="gone"
          title="No player with this tag"
          body={`The tag ${tag} did not resolve. The player left the game, or the tag has a typo: tags are 3 to 20 letters and numbers after the #. Try the tag lookup instead.`}
          action={<PillButton label="Tag lookup" role="link" arrow onPress={onLookup} />}
        />
      );
    }
    if (result.kind === 'busy') {
      return (
        <ErrorState
          tone="busy"
          title="The game API is busy"
          body={`Upstream answered 429 and automatic retries have not cleared it yet. Trying again now may work, or wait about ${result.retryAfter}s and retry.`}
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
    if (result.kind === 'unreachable') {
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
        body={`The tier rejected the tag ${tag}: ${result.detail}. Tags start with # and use letters and numbers only.`}
      />
    );
  }
  return (
    <ErrorState
      tone="gone"
      title="Something went wrong"
      body={error.message || 'An unexpected error happened while fetching the player.'}
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

// ---------- styles ----------

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    column: {
      flex: 1,
    },
    // The crumbs sit a full step above the content, the same clearance the
    // clan detail card keeps (the owner's spacing note), so the loading and
    // error states keep it too.
    breadcrumbWrap: {
      marginBottom: t.spacing[4],
    },
    // The error panel's own gap, mirroring the clan screen's detail panel.
    detailPanel: {
      gap: t.spacing[5],
    },

    // The two-column rule (07 section 3): identity + analysis from 1024 px
    // up. The columns top-align; the identity card is a fixed shape and the
    // analysis sections carry the variable content, so neither stretches to
    // match the other's height.
    columns: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      columnGap: t.spacing[5],
    },
    // The identity card keeps about a third of the row and never grows into
    // the analysis column's room; it may shrink a little on the narrower
    // desktop viewports, where its stat grid already wraps two per row.
    identityColumn: {
      flexBasis: '36%',
      flexGrow: 0,
      flexShrink: 1,
      minWidth: 0,
    },
    analysisColumn: {
      flexBasis: '58%',
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
      gap: t.spacing[4],
    },
    stackedColumn: {
      gap: t.spacing[5],
    },
    sectionStack: {
      gap: t.spacing[4],
    },

    // The identity card: name, the tag + clan line, a hairline, then the
    // stat grid. The card carries the panelRaised chrome the clan detail
    // card uses, so the site's two detail headers read as one family.
    identityCard: {
      gap: t.spacing[5],
    },
    identityText: {
      gap: t.spacing[1],
    },
    identityMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      columnGap: t.spacing[2],
      rowGap: t.spacing[1],
    },
    tagLine: {
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.sm,
      color: c.textMuted,
    },
    metaDot: {
      fontSize: t.fontSize.xs,
      color: c.hairline,
    },
    clanLine: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textMuted,
    },
    statDivider: {
      height: 1,
      backgroundColor: c.hairline,
    },
    // The stat grid, the same wrap the clan detail card renders: cells flex
    // within their row so the grid stays even at any width.
    statGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: t.spacing[4],
      rowGap: t.spacing[4],
    },
    statCell: {
      flexGrow: 1,
      flexShrink: 1,
      gap: t.spacing[1],
    },
    // The basis sits under a half row so the wrap lands on even columns
    // while flexGrow fills each line to the edges; the quarter basis is the
    // clan card's four-up form, used only when the card runs full width.
    statCellHalf: {
      flexBasis: '46%',
    },
    statCellQuarter: {
      flexBasis: '22%',
    },
    statLabel: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: LABEL_TRACKING,
    },
    statValueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: t.spacing[2],
      minWidth: 0,
    },
    statValue: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    // The league icon slot (07 section 7): fixed 24 px box.
    leagueIcon: {
      width: LEAGUE_ICON_SLOT,
      height: LEAGUE_ICON_SLOT,
    },
    loadingCaption: {
      marginTop: t.spacing[1],
    },

    // footer: the fetch age only, the same quiet line the clan screen keeps.
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      flexWrap: 'wrap',
      gap: t.spacing[3],
      marginTop: t.spacing[6],
      marginBottom: t.spacing[8],
    },
  });
}
