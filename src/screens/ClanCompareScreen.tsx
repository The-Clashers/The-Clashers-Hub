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
import { fetchClan, ClanFetchError, type ClanResponse } from '../api/clan';
import { fetchWarlog, WarlogFetchError, type WarlogResponse } from '../api/warlog';
import { busyRetryDelayMs, shouldRetryBusy } from '../lib/busy-retry';
import { computeDonationBalance } from '../lib/donation-balance';
import { summarizeWarEfficiency } from '../lib/war-efficiency';
import { computeClanCompare, type ClanCompareSide } from '../engines/compare';
import { clanRouteFor, normalizeTagInput } from '../lib/tag';
import { linkEnterActivation } from '../lib/link-activation';

// The clan comparison screen (T-M3-4, FR-13, FR-14). The compare landing's
// "Compare Clans" lands here, on the shareable /compare/clans?a=TAG&b=TAG
// URL the feature list documents: two bare tags in the query string,
// canonicalized back through the one tag module so the fetches, the cache
// keys, and the identity cards all agree on #TAG.
//
// The fetch discipline mirrors the player compare with the clan screen's
// own keys: one clan query per side (['clan', tag], the detail screen's
// own entry, so a clan the visitor just opened answers from the shared
// cache) plus one war log query per side (['warlog', tag], the Log tab's
// own entry). Four queries, two TTL pairs (180 s clan, 600 s warlog), the
// same pairing every route keeps.
//
// The analysis boundary is the house rule: the clan payload plus the war
// log arrive, the adapter trues each side into the structural
// ClanCompareSide (the donation engine answers the health figure, the
// war-efficiency engine the log rates), and the compare engine turns the
// two sides into metric rows (05 section 4). The engine owns every
// judgment; the screen never colors a value itself.
//
// A war log that fails to load is not a private log: the private reading
// is a success shape (dashes plus the note, the designed state), while a
// failed fetch replaces the war record group with its own retry panel so
// the two never read the same. The roster stats stay on screen either
// way; the comparison never renders half-loaded identities.

// The client staleTimes mirror the tier's TTLs (04 section 5) so the two
// cache layers decay together: 180 s for the clan, 600 s for the war log.
const CLAN_STALE_TIME_MS = 180_000;
const WARLOG_STALE_TIME_MS = 600_000;

export default function ClanCompareScreen() {
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
                  { label: 'Clan comparison' },
                ]}
              />
            </View>
            <EmptyState
              title="Two clan tags are needed"
              body="A clan comparison reads /compare/clans with two tags in the address bar, one after a= and one after b=. Pick both clans on the compare screen instead."
              action={
                <PillButton
                  label="Choose clans"
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

  return <ClanCompareView tagA={tagA.tag} tagB={tagB.tag} />;
}

// ---------- the loaded screen ----------

interface ClanCompareViewProps {
  tagA: string;
  tagB: string;
}

function ClanCompareView({ tagA, tagB }: ClanCompareViewProps) {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigate = useNavigate();

  // One clan query per side, the clan detail's own key and retry policy
  // so the cache the visitor already holds answers here (04 section 5,
  // 06 section 2): 404 and 400 are permanent for a hand-typed pair, busy
  // paces itself through lib/busy-retry, everything else one retry.
  const clanA = useQuery({
    queryKey: ['clan', tagA] as const,
    queryFn: () => fetchClan(tagA),
    staleTime: CLAN_STALE_TIME_MS,
    retry: (failureCount, error) => clanRetryPolicy(failureCount, error),
    retryDelay: (failureCount, error) => retryDelay(failureCount, error),
  });
  const clanB = useQuery({
    queryKey: ['clan', tagB] as const,
    queryFn: () => fetchClan(tagB),
    staleTime: CLAN_STALE_TIME_MS,
    retry: (failureCount, error) => clanRetryPolicy(failureCount, error),
    retryDelay: (failureCount, error) => retryDelay(failureCount, error),
  });

  // One war log query per side, the Log tab's own key. Enabled only once
  // that side's clan answered, exactly how the Log tab gates its fetch
  // behind the clan's own success; the retry policy mirrors it.
  const warlogA = useQuery({
    queryKey: ['warlog', tagA] as const,
    queryFn: () => fetchWarlog(tagA),
    enabled: clanA.isSuccess,
    staleTime: WARLOG_STALE_TIME_MS,
    retry: (failureCount, error) => warlogRetryPolicy(failureCount, error),
    retryDelay: (failureCount, error) => retryDelay(failureCount, error),
  });
  const warlogB = useQuery({
    queryKey: ['warlog', tagB] as const,
    queryFn: () => fetchWarlog(tagB),
    enabled: clanB.isSuccess,
    staleTime: WARLOG_STALE_TIME_MS,
    retry: (failureCount, error) => warlogRetryPolicy(failureCount, error),
    retryDelay: (failureCount, error) => retryDelay(failureCount, error),
  });

  // The busy note reads across all four queries: any side still pacing
  // through a busy answer keeps the skeleton and switches its caption.
  const busyRetrying =
    busyPacingClan(clanA) ||
    busyPacingClan(clanB) ||
    busyPacingWarlog(warlogA) ||
    busyPacingWarlog(warlogB);

  // A war log query whose clan failed never enables, so it must not
  // count as pending either: the war logs only gate the screen once both
  // clans answered.
  const bothClansLoaded = clanA.isSuccess && clanB.isSuccess;
  const anyPending =
    clanA.isPending ||
    clanB.isPending ||
    (bothClansLoaded && (warlogA.isPending || warlogB.isPending));

  // The first clan side that failed names the error panel; the
  // comparison cannot render without both clans, so one panel says which
  // half is missing and offers the two fixes: retry, or pick a different
  // pair.
  const failedClanQuery = clanA.isError ? clanA : clanB.isError ? clanB : null;
  const failedTag = clanA.isError ? tagA : tagB;

  // A failed war log (never a private one: that is a success shape) is
  // its own state below the face-off, with its own retry.
  const failedWarlogQueries = [warlogA, warlogB].filter((query) => query.isError);
  const failedWarlogTags = failedWarlogQueries.map((query) =>
    query === warlogA ? tagA : tagB,
  );
  const warlogRetrying = failedWarlogQueries.some((query) => query.isFetching);

  return (
    <View style={base.appRoot}>
      <View style={base.screen}>
        <View style={[base.contentColumn, styles.column]}>
          <View style={styles.breadcrumbWrap}>
            <Breadcrumbs
              crumbs={[
                { label: 'Home', route: '/' },
                { label: 'Compare', route: '/compare' },
                { label: 'Clan comparison' },
              ]}
            />
          </View>

          <View style={styles.header}>
            <Text style={base.display}>Clan comparison</Text>
            <Text style={base.subtitle}>
              Roster stats and war record, side by side, with the better value
              colored on every row.
            </Text>
            <Text style={styles.noWinnerNote}>
              Per-metric verdicts only. There is no single overall winner:
              summing unlike units into one score is false precision.
            </Text>
          </View>

          {anyPending ? (
            <CompareLoading busyRetrying={busyRetrying} />
          ) : failedClanQuery ? (
            <CompareError
              error={failedClanQuery.error as ClanFetchError | Error}
              tag={failedTag}
              onRetry={() => void failedClanQuery.refetch()}
              isRetrying={failedClanQuery.isFetching}
              onPick={() => navigate('/compare')}
            />
          ) : failedWarlogQueries.length > 0 ? (
            <>
              <CompareSuccess
                clanA={clanA.data!}
                clanB={clanB.data!}
                warlogA={warlogA.isError ? null : warlogA.data!}
                warlogB={warlogB.isError ? null : warlogB.data!}
                stripWarNote
              />
              <WarlogErrorPanel
                tags={failedWarlogTags}
                onRetry={() => {
                  for (const query of failedWarlogQueries) void query.refetch();
                }}
                isRetrying={warlogRetrying}
              />
            </>
          ) : (
            <CompareSuccess
              clanA={clanA.data!}
              clanB={clanB.data!}
              warlogA={warlogA.data!}
              warlogB={warlogB.data!}
            />
          )}
        </View>
      </View>
    </View>
  );
}

function clanRetryPolicy(failureCount: number, error: unknown): boolean {
  if (error instanceof ClanFetchError) {
    if (error.result.kind === 'not_found' || error.result.kind === 'bad_request') {
      return false;
    }
    if (error.result.kind === 'busy') {
      return shouldRetryBusy(failureCount);
    }
  }
  return failureCount < 1;
}

function warlogRetryPolicy(failureCount: number, error: unknown): boolean {
  if (error instanceof WarlogFetchError) {
    // The clan itself already loaded when this query runs at all, so a
    // war log 404 is an anomaly no retry can fix, and a bad_request is
    // our own URL being wrong; the busy outcome paces itself.
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
  if (
    (error instanceof ClanFetchError || error instanceof WarlogFetchError) &&
    error.result.kind === 'busy'
  ) {
    return busyRetryDelayMs(error.result.retryAfter, failureCount);
  }
  return 1_000;
}

/** True while a clan query paces through a busy answer: pending with a
 * busy failure reason, the same read every busy-aware screen keeps. */
function busyPacingClan(query: {
  isPending: boolean;
  failureReason: unknown;
}): boolean {
  return (
    query.isPending &&
    query.failureReason instanceof ClanFetchError &&
    query.failureReason.result.kind === 'busy'
  );
}

/** The war log twin of {@link busyPacingClan}. */
function busyPacingWarlog(query: {
  isPending: boolean;
  failureReason: unknown;
}): boolean {
  return (
    query.isPending &&
    query.failureReason instanceof WarlogFetchError &&
    query.failureReason.result.kind === 'busy'
  );
}

// ---------- success: identity cards + metric rows ----------

interface CompareSuccessProps {
  clanA: ClanResponse;
  clanB: ClanResponse;
  /** Null per side when that side's war log fetch failed: the failed
   * side's rates read the dash while the answered side's stay on screen. */
  warlogA: WarlogResponse | null;
  warlogB: WarlogResponse | null;
  /** True on the warlog-error state: the retry panel owns the
   * explanation, so the engine's sample-size note (which would call the
   * failed side's dash "private") is not rendered. */
  stripWarNote?: boolean;
}

function CompareSuccess({ clanA, clanB, warlogA, warlogB, stripWarNote = false }: CompareSuccessProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Two-up from tablet up, stacked below it: the same breakpoint family
  // the standings cards and the player compare keep (07 section 3), read
  // through useWindowDimensions, never CSS media queries.
  const { width } = useWindowDimensions();
  const twoUp = breakpointFor(width) === 'tablet' || breakpointFor(width) === 'desktop';

  // The adapter trues each clan payload plus its war log into the
  // structural side the compare engine consumes (05 section 4): the
  // donation engine answers the health figure, the war-efficiency engine
  // the log rates, and the engine never sees a payload shape.
  const sideA = useMemo(() => clanToCompareSide(clanA, warlogA), [clanA, warlogA]);
  const sideB = useMemo(() => clanToCompareSide(clanB, warlogB), [clanB, warlogB]);

  const groups = useMemo(() => {
    const computed = computeClanCompare(sideA, sideB);
    if (!stripWarNote) return computed;
    return computed.map((group) => (group.id === 'war' ? { ...group, note: undefined } : group));
  }, [sideA, sideB, stripWarNote]);

  return (
    <>
      <View style={twoUp ? styles.faceOffRow : styles.faceOffColumn}>
        <CompareSideCard side={sideA} clan={clanA} sharesRow={twoUp} />
        <View style={twoUp ? styles.vsRow : styles.vsColumn} aria-hidden>
          <View style={styles.vsCircle}>
            <Text style={styles.vsText}>VS</Text>
          </View>
        </View>
        <CompareSideCard side={sideB} clan={clanB} sharesRow={twoUp} />
      </View>
      <CompareMetricRows groups={groups} aName={sideA.name} bName={sideB.name} />
    </>
  );
}

// ---------- one side's identity card ----------

interface CompareSideCardProps {
  side: ClanCompareSide;
  clan: ClanResponse;
  /** True when the card flexes to share the two-up row. */
  sharesRow: boolean;
}

function CompareSideCard({ side, clan, sharesRow }: CompareSideCardProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigate = useNavigate();

  // The badge API icon renders into a fixed 24 px slot (07 section 7) so
  // a slow CDN load never reflows the card; a clan without a badge gets
  // the quiet placeholder block.
  const badgeUri = clan.badgeUrls?.medium || clan.badgeUrls?.small;

  // Three context cells, the player compare's own family: two roster
  // facts the rows below compare (Members, Average Town Hall) plus the
  // war log's visibility, the fact the stat grid already surfaces so a
  // visitor knows before the War record rows whether dashes mean private.
  const stats: ReadonlyArray<{ label: string; value: string }> = [
    { label: 'Members', value: String(clan.members) },
    {
      label: 'Average TH',
      value:
        side.averageTownHall === null
          ? '\u2014'
          : String(Math.round(side.averageTownHall * 10) / 10),
    },
    { label: 'War log', value: clan.isWarLogPublic ? 'Public' : 'Private' },
  ];

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${side.name}, level ${clan.clanLevel}, ${clan.members} members. Opens the clan's full page.`}
      onPress={() => navigate(clanRouteFor(clan.tag))}
      onKeyDown={linkEnterActivation(() => navigate(clanRouteFor(clan.tag)))}
      style={({ pressed }) => [
        styles.sideCard,
        sharesRow && styles.sideCardSharesRow,
        pressed && styles.sideCardPressed,
      ]}
    >
      <View style={styles.sideIdentity}>
        {badgeUri ? (
          <Image
            source={{ uri: badgeUri }}
            style={styles.clanBadge}
            accessibilityLabel={`${side.name} clan badge`}
          />
        ) : (
          <View style={[styles.clanBadge, styles.clanBadgeEmpty]} />
        )}
        <View style={styles.sideIdentityText}>
          <Text style={styles.sideName} numberOfLines={1}>
            {side.name}
          </Text>
          <View style={styles.sideMeta}>
            <Text style={styles.tagLine}>{clan.tag}</Text>
            {clan.location ? (
              <>
                <Text style={styles.metaDot} aria-hidden>
                  |
                </Text>
                <Text style={styles.locationLine} numberOfLines={1}>
                  {clan.location.name}
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

      <Text style={styles.openPage}>View clan page</Text>
    </Pressable>
  );
}

// ---------- the adapter: payloads + engines, into the engine's side ----------

/**
 * Trues one clan payload plus its war log into the structural side the
 * compare engine consumes. This is the adapter's job the same way the
 * player compare's adapter owns payload shapes (05 section 1 "Grouping is
 * an adapter's job"): the engine never sees a ClanResponse.
 *
 * The donation engine answers the health figure (the roster header's own
 * chip), the war-efficiency engine the log rates, and a private log
 * resolves to nulls (the dash, the designed state). A null warlog (the
 * failed-fetch state) resolves to the same nulls; the screen replaces
 * the war record group with its retry panel so the two never read the
 * same.
 */
function clanToCompareSide(clan: ClanResponse, warlog: WarlogResponse | null): ClanCompareSide {
  const roster = clan.memberList ?? [];
  const averageTownHall =
    roster.length > 0
      ? roster.reduce((sum, member) => sum + member.townHallLevel, 0) / roster.length
      : null;
  const balance = computeDonationBalance(roster);
  const summary =
    warlog !== null && !warlog.private ? summarizeWarEfficiency(warlog.entries) : null;

  return {
    name: clan.name,
    tag: clan.tag,
    members: clan.members,
    clanLevel: clan.clanLevel,
    averageTownHall,
    donationHealth: balance.summary.healthShare,
    warWins: clan.warWins,
    warWinStreak: clan.warWinStreak,
    winRate: summary?.winRate ?? null,
    starsPerAttack: summary?.starsPerAttack ?? null,
    averageDestruction: summary?.averageDestruction ?? null,
    warLogWars: summary !== null ? summary.wars : null,
    warLogLeagues: summary !== null ? summary.leagues : null,
  };
}

// ---------- the warlog failure panel ----------

interface WarlogErrorPanelProps {
  tags: string[];
  onRetry: () => void;
  isRetrying: boolean;
}

function WarlogErrorPanel({ tags, onRetry, isRetrying }: WarlogErrorPanelProps) {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[base.statePanel, styles.warlogPanel]} accessibilityRole="alert">
      <Text style={styles.warlogTitle}>The war log did not load</Text>
      <Text style={styles.warlogBody}>
        The war record rows read each clan's war log, and {tags.join(' and ')}{' '}
        did not answer, so those rates read the dash. The rates that answered
        are shown; retry usually clears the rest.
      </Text>
      <PillButton
        label={isRetrying ? 'Retrying\u2026' : 'Retry the war log'}
        onPress={onRetry}
        disabled={isRetrying}
      />
    </View>
  );
}

// ---------- loading ----------

interface CompareLoadingProps {
  busyRetrying: boolean;
}

function CompareLoading({ busyRetrying }: CompareLoadingProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const pulse = useSkeletonPulse();

  const { width } = useWindowDimensions();
  const twoUp = breakpointFor(width) === 'tablet' || breakpointFor(width) === 'desktop';

  return (
    <View
      style={twoUp ? styles.faceOffRow : styles.faceOffColumn}
      accessibilityLabel="Clan comparison loading"
    >
      {[0, 1].map((index) => (
        <View key={index} style={[styles.sideCard, twoUp && styles.sideCardSharesRow]}>
          <View style={styles.sideIdentity}>
            <SkeletonBlock width={24} height={24} pulse={pulse} radiusStep={1} />
            <View style={styles.sideIdentityText}>
              <SkeletonBlock width={160} height={theme.fontSize.md} pulse={pulse} />
              <SkeletonBlock width={120} height={theme.fontSize.xs} pulse={pulse} />
            </View>
          </View>
          <View style={styles.statRow}>
            {[0, 1, 2].map((cell) => (
              <SkeletonBlock
                key={cell}
                width="30%"
                height={theme.fontSize.lg}
                pulse={pulse}
              />
            ))}
          </View>
          {busyRetrying ? (
            <Text style={styles.loadingCaption}>
              The game API is busy. One moment, retrying automatically…
            </Text>
          ) : null}
        </View>
      ))}
      {/* Two row-group panels stand in for the two group panels below:
          the roster stats' three rows, the war record's five. */}
      {[3, 5].map((lines, panel) => (
        <View
          key={panel}
          style={styles.groupSkeleton}
          accessibilityLabel="Comparison rows loading"
        >
          <View style={styles.groupSkeletonColumn}>
            {Array.from({ length: lines }, (_, line) => (
              <SkeletonBlock
                key={line}
                width="100%"
                height={theme.fontSize.body}
                pulse={pulse}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

// ---------- error ----------

interface CompareErrorProps {
  error: ClanFetchError | Error;
  tag: string;
  onRetry: () => void;
  isRetrying: boolean;
  onPick: () => void;
}

function CompareError({ error, tag, onRetry, isRetrying, onPick }: CompareErrorProps) {
  // The contract's four failure kinds, the clan detail's own wording,
  // with the compare's own second action: picking a different pair is
  // the fix a stale tag needs, retry is the fix everything else does
  // (06 section 3, 04 section 6).
  if (error instanceof ClanFetchError && error.result.kind === 'not_found') {
    return (
      <ErrorState
        tone="gone"
        title="No clan with this tag"
        body={`The tag ${tag} on one side of the comparison did not resolve. The clan was retired, or the tag has a typo: tags are 3 to 20 letters and numbers after the #. Pick a different clan for that side.`}
        action={
          <PillButton label="Choose clans" role="link" arrow onPress={onPick} />
        }
      />
    );
  }
  if (error instanceof ClanFetchError && error.result.kind === 'busy') {
    return (
      <ErrorState
        tone="busy"
        title="The game API is busy"
        body={`Upstream answered 429 and automatic retries have not cleared it yet. Trying again now may work, or wait about ${error.result.retryAfter}s and retry.`}
        action={
          <PillButton
            label={isRetrying ? 'Retrying\u2026' : 'Retry now'}
            onPress={onRetry}
            disabled={isRetrying}
          />
        }
      />
    );
  }
  if (error instanceof ClanFetchError && error.result.kind === 'unreachable') {
    return (
      <ErrorState
        tone="gone"
        title="Can't reach the game API"
        body="The proxy or the game API did not answer. This is usually transient; retry in a moment."
        action={
          <PillButton
            label={isRetrying ? 'Retrying\u2026' : 'Retry'}
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
      body={`One side of the comparison carries a tag the address bar cannot resolve (${tag}). Tags are 3 to 20 letters and numbers after the #. Pick both clans on the compare screen instead.`}
      action={
        <PillButton label="Choose clans" role="link" arrow onPress={onPick} />
      }
    />
  );
}

// ---------- styles ----------

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  const base = createBaseStyles(t);
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
    // raised fill, glass top edge), a link to the clan's full page, with
    // focus and press states the kit's interactive pieces keep.
    sideCard: {
      ...base.panelRaised,
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
    // The clan badge's fixed 24 px slot (07 section 7): API icon in a
    // fixed box so a slow CDN load never reflows the card.
    clanBadge: {
      width: 24,
      height: 24,
      borderRadius: t.radius[1],
      backgroundColor: c.panel,
    },
    clanBadgeEmpty: {
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
    locationLine: {
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
    openPage: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.accentInk,
      textTransform: 'uppercase',
      letterSpacing: t.letterSpacing.micro,
    },

    // The warlog failure panel rides under the roster stats, inside the
    // state panel's own chrome with room for its retry button.
    warlogPanel: {
      gap: t.spacing[2],
    },
    warlogTitle: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.md,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
    },
    warlogBody: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textSecondary,
      lineHeight: t.lineHeight.normal * t.fontSize.sm,
    },

    // The loading state's row-shape skeletons, matched to the two group
    // panels they stand in for.
    groupSkeleton: {
      ...base.panel,
      marginTop: t.spacing[2],
    },
    groupSkeletonColumn: {
      gap: t.spacing[2],
    },
    loadingCaption: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      color: c.textMuted,
      marginTop: t.spacing[1],
    },
  });
}
