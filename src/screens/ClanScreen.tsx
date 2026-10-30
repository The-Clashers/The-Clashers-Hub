import { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useParams, useSearchParams, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTheme, createBaseStyles, breakpointFor } from '../theme';
import Breadcrumbs from '../components/Breadcrumbs';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import PillButton from '../components/PillButton';
import RosterTable from '../components/RosterTable';
import RosterCard from '../components/RosterCard';
import AttentionTable from '../components/AttentionTable';
import AttentionCard from '../components/AttentionCard';
import SkeletonCard from '../components/Skeleton';
import SkeletonBlock, { useSkeletonPulse } from '../components/SkeletonBlock';
import Dropdown from '../components/Dropdown';
import { fetchClan, ClanFetchError, type ClanMember } from '../api/clan';
import { attacksLeftFor, fetchCurrentWar } from '../api/war';
import { busyRetryDelayMs, shouldRetryBusy } from '../lib/busy-retry';
import { warFrequencyLabel } from '../lib/war-frequency';
import { canonicalTagFromRoute, playerRouteFor } from '../lib/tag';
import {
  CLAN_ORDER,
  flipRosterSortDirection,
  nextRosterSortState,
  rosterSortForSelection,
  sortRoster,
  type RosterSortKey,
  type RosterSortSelection,
  type RosterSortState,
} from '../lib/roster-sort';
import {
  computeDonationBalance,
  sortNeedsAttention,
  DEFAULT_DONATION_TARGET,
  type DonationTarget,
  type DonationVerdict,
} from '../lib/donation-balance';

// The clan detail screen (T-M1-3, FR-03, SR-10). The search result cards and
// the nav lookup's #tag path both land here. The screen owns layout and the
// route's state; the pieces it renders come from the shared kit (07 section
// 4): ErrorState for the contract's three failure kinds, EmptyState for the
// designed "this tab lands later" placeholder, PillButton for the retry
// action, RosterTable and RosterCard for the Roster tab (T-M1-4),
// AttentionTable and AttentionCard for the Needs Attention tab. The brand
// and the theme toggle live in the NavBar since the nav revision, so this
// screen starts with breadcrumbs instead of a header: Home > Clans >
// <clan name>, the location line that also says where the back path goes
// (the owner's call; the back-to-search button retired with it).
//
// The clan details card stacks three bands (the owner's better-layout
// call over the two-column wireframe): the identity row (badge, name, the
// tag/level/location line), the description under it, then a hairline and
// a uniform stat grid, four cells per row from tablet up and two below
// it. The war log's public/private status is one of the grid cells, so a
// visitor knows before opening the Log tab whether there is anything to
// read.
//
// The tab bar reads `?tab=` from the URL (03 section 2 "Screens & URLs") so
// a deep link to the War, Log, or Needs Attention tab is shareable (F-12).
// Roster is the default when the param is absent or holds an unknown value.
// The War and Log tabs keep their designed placeholders until M3; the
// Roster tab renders the real roster from the same single clan fetch
// (SR-09); the Needs Attention tab renders the worst-first donation view
// with its own table and the war-attacks column (the owner's layout).
//
// The route param carries the bare tag (shareable URLs carry no `#` and no
// `%23`, see src/lib/tag.ts), canonicalized back through the tag module so
// the fetch, the cache key, and the on-screen tag all agree on `#TAG`.

// ---------- tab bar ----------

/** The four tabs the clan detail screen renders, in order. */
type ClanTab = 'roster' | 'war' | 'log' | 'attention';

const TABS: ReadonlyArray<{ id: ClanTab; label: string }> = [
  { id: 'roster', label: 'Roster' },
  { id: 'war', label: 'War' },
  { id: 'log', label: 'Log' },
  { id: 'attention', label: 'Needs Attention' },
];

/** Maps a raw ?tab= value to a known tab, defaulting to Roster. Unknown
 * values fall back to the default so a stale or typo'd deep link still lands
 * on a real tab instead of an empty content area. */
function tabFromValue(raw: string | null): ClanTab {
  if (raw === 'war' || raw === 'log' || raw === 'attention') return raw;
  return 'roster';
}

// The client staleTime mirrors the tier's 180 s clan TTL (SR-09) so the two
// cache layers decay together, the same pairing the hello screen uses.
const CLAN_STALE_TIME_MS = 180_000;

// The war fetch mirrors the tier's 120 s war TTL (04 section 5). It only
// runs while the Needs Attention tab is open (the attacks-left column is
// its only reader today); the M3 war view will reuse the same cache entry.
const WAR_STALE_TIME_MS = 120_000;

export default function ClanScreen() {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const tag = canonicalTagFromRoute(params.tag ?? '');
  const activeTab = tabFromValue(searchParams.get('tab'));

  const query = useQuery({
    queryKey: ['clan', tag] as const,
    queryFn: () => fetchClan(tag),
    staleTime: CLAN_STALE_TIME_MS,
    retry: (failureCount, error) => {
      // A 404 is permanent for a tag the user navigated to (the clan was
      // retired or the URL is stale); retrying burns no upstream calls
      // thanks to the 30 s negative cache, but it cannot fix anything, so
      // we stop. A 400 is our URL being wrong; retrying the same request
      // cannot fix it. The busy outcome auto-retries with backoff (06
      // section 3): the tier already retried the throttle itself, so the
      // client paces itself through lib/busy-retry and the screen keeps
      // its skeleton with a "one moment" note instead of flipping to an
      // error screen. Everything else gets the single default retry.
      if (error instanceof ClanFetchError) {
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
      if (error instanceof ClanFetchError && error.result.kind === 'busy') {
        return busyRetryDelayMs(error.result.retryAfter, failureCount);
      }
      // Only the single default retry ever waits on this: the library's
      // own first backoff.
      return 1_000;
    },
  });

  // The current war, fetched only while the Needs Attention tab is open:
  // the attacks-left column is its only reader today, and a clan that is
  // not in a war makes this a wasted upstream call on every visit. A
  // failure here never breaks the tab, the column renders dashes and the
  // note line says why (the state matrix belongs to the clan fetch; the
  // war fetch is supplementary).
  const warQuery = useQuery({
    queryKey: ['war', tag] as const,
    queryFn: () => fetchCurrentWar(tag),
    enabled: query.isSuccess && activeTab === 'attention',
    staleTime: WAR_STALE_TIME_MS,
    retry: (failureCount) => failureCount < 1,
  });

  // True while the first load is auto-retrying a busy answer: the skeleton
  // stays up and its caption switches to the "one moment" note (06
  // section 3), so a throttled demo reads as a slow fetch, not an error.
  const busyRetrying =
    query.isPending &&
    query.failureReason instanceof ClanFetchError &&
    query.failureReason.result.kind === 'busy';

  const selectTab = (next: ClanTab) => {
    // Replace, not push: tab switches are state on the same route, not pages
    // in the back stack. A user pressing Back from the War tab expects to
    // leave the clan, not bounce to the Roster tab.
    const updated = new URLSearchParams(searchParams);
    if (next === 'roster') {
      updated.delete('tab');
    } else {
      updated.set('tab', next);
    }
    setSearchParams(updated, { replace: true });
  };

  // The attacks-left lookup the Needs Attention tab renders: the parsed
  // projection from api/war.ts, null (the dash) for everything the war
  // payload cannot answer.
  const war = warQuery.data;
  const attacksLeft = (memberTag: string) => attacksLeftFor(war, memberTag);
  const warNote =
    warQuery.isError
      ? 'War data did not load, so attacks left shows a dash for now.'
      : war !== undefined && war.state !== 'inWar' && war.state !== 'preparation'
        ? 'The clan is not in a war right now, so attacks left shows a dash.'
        : null;

  // The breadcrumb's current crumb: the clan name once it is in hand, the
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
                { label: 'Clans', route: '/clans' },
                { label: currentCrumb },
              ]}
            />
          </View>

          {query.isPending ? (
            <ClanLoading busyRetrying={busyRetrying} />
          ) : (
            <>
              <View style={[base.panelRaised, styles.detailPanel]}>
                {query.isError ? (
                  <ClanError
                    error={query.error as ClanFetchError | Error}
                    onRetry={() => void query.refetch()}
                    onSearch={() => navigate('/clans')}
                    isRetrying={query.isFetching}
                    tag={tag}
                  />
                ) : (
                  <ClanSuccess clan={query.data} base={base} styles={styles} />
                )}
              </View>

              {query.isSuccess ? (
                <View style={styles.tabBar} accessibilityRole="tablist">
                  {TABS.map((tab) => (
                    <TabButton
                      key={tab.id}
                      label={tab.label}
                      active={tab.id === activeTab}
                      onPress={() => selectTab(tab.id)}
                      styles={styles}
                    />
                  ))}
                </View>
              ) : null}

              {query.isSuccess ? (
                <View style={styles.tabContent}>
                  {activeTab === 'roster' ? (
                    <RosterSection members={query.data.memberList ?? []} />
                  ) : activeTab === 'attention' ? (
                    <AttentionSection
                      members={query.data.memberList ?? []}
                      attacksLeft={attacksLeft}
                      warNote={warNote}
                    />
                  ) : (
                    <TabPlaceholder tab={activeTab} />
                  )}
                </View>
              ) : null}
            </>
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

// ---------- success: two-column details card ----------

interface ClanSuccessProps {
  clan: Awaited<ReturnType<typeof fetchClan>>;
  base: ReturnType<typeof createBaseStyles>;
  styles: ReturnType<typeof createStyles>;
}

function ClanSuccess({ clan, base, styles }: ClanSuccessProps) {
  // The details card as three stacked bands (the owner's better-layout
  // call): the identity row (badge, name, the tag/level/location line),
  // the description under it at full width, then a hairline and a uniform
  // stat grid. Every F-04 datum survives; the grid replaces the old
  // centered chip wrap, which read as a ragged cloud of unequal chips
  // (the owner's screenshot note). Four cells per row from tablet up, two
  // below, and the war log's public/private visibility is one of the
  // cells. The badge is an API icon (07 section 7) in the 48 px slot,
  // rendered through RN Image so a slow CDN load never reflows the block;
  // a missing badge gets a quiet block instead, never a broken-image
  // glyph.
  const { width } = useWindowDimensions();
  const breakpoint = breakpointFor(width);
  const twoColumns = breakpoint === 'tablet' || breakpoint === 'desktop';
  const badgeUri = clan.badgeUrls?.medium || clan.badgeUrls?.small;
  const locationName = clan.location?.name ?? 'No location';
  // The stat grid, ordered clan vitals first (what the clan is), then the
  // war facts and the join requirements. The cells render as one flat
  // uniform grid, no group headings; the labels carry the grouping.
  const stats: ReadonlyArray<{ label: string; value: string }> = [
    { label: 'Members', value: String(clan.members) },
    { label: 'Points', value: String(clan.clanPoints) },
    { label: 'War wins', value: String(clan.warWins) },
    { label: 'Win streak', value: String(clan.warWinStreak) },
    { label: 'War', value: warFrequencyLabel(clan.requirements.warFrequency) },
    { label: 'War log', value: clan.isWarLogPublic ? 'Public' : 'Private' },
    { label: 'Trophies req', value: String(clan.requirements.requiredTrophies) },
    ...(clan.requirements.requiredTownhallLevel !== undefined
      ? [{ label: 'TH req', value: `TH ${clan.requirements.requiredTownhallLevel}` }]
      : []),
  ];

  return (
    <View style={styles.successWrap} accessibilityLabel={`${clan.name} clan detail`}>
      <View style={styles.identityRow}>
        {badgeUri ? (
          <Image
            source={{ uri: badgeUri }}
            style={styles.badge}
            accessibilityLabel={`${clan.name} clan badge`}
          />
        ) : (
          <View style={styles.badgePlaceholder} accessibilityLabel={`${clan.name} clan badge`} />
        )}
        <View style={styles.identityText}>
          <Text style={base.title} numberOfLines={1}>
            {clan.name}
          </Text>
          <View style={styles.identityMeta}>
            <Text style={styles.tagLine}>{clan.tag}</Text>
            <Text style={styles.metaDot} aria-hidden>
              |
            </Text>
            <Text style={styles.levelChip}>Level {clan.clanLevel}</Text>
            <Text style={styles.metaDot} aria-hidden>
              |
            </Text>
            <Text style={styles.locationLine}>{locationName}</Text>
          </View>
        </View>
      </View>

      {clan.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {clan.description}
        </Text>
      ) : null}

      <View style={styles.statDivider} aria-hidden />

      <View style={styles.statGrid}>
        {stats.map((stat) => (
          <View
            key={stat.label}
            style={[styles.statCell, twoColumns ? styles.statCellQuarter : styles.statCellHalf]}
          >
            <Text style={styles.statLabel}>{stat.label}</Text>
            <Text style={styles.statValue} numberOfLines={1}>
              {stat.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ---------- loading skeleton (T-M1-6, 06 section 3) ----------

interface ClanLoadingProps {
  /** True while a busy answer is being auto-retried; swaps the caption to
   * the "one moment" note so a throttled upstream reads as a slow fetch. */
  busyRetrying: boolean;
}

// The skeleton mirrors the whole success layout, not just the identity
// panel: without the tab bar and roster shapes below, the first paint
// would hold only the header's height and the page would visibly grow and
// reflow the moment data landed (the layout-matched rule, 06 section 3).
// Every size here mirrors a real element; if the success layout changes,
// this follows in the same PR. The detail half mirrors the stacked card:
// the identity row (badge 48, one-line name, meta line), the two-line
// description, the hairline, and the uniform stat grid (8 cells, 4 per
// row from tablet up, 2 below).

// The identity block's fixed badge slot (the success state renders the
// API badge at this size, 07 section 7).
const SKELETON_BADGE_SLOT = 48;

// Line widths chosen to read as a name and a meta line; the stat cells
// mirror the uniform grid they stand in for.
const SKELETON_NAME_WIDTH = 220;
const SKELETON_META_WIDTH = 180;

// The stat cells the skeleton draws, matching the success grid's usual
// count (8 when the clan sets a TH requirement).
const SKELETON_STAT_CELLS = 8;

// Enough roster rows to fill a laptop viewport; the roster renders in
// page flow now, so the skeleton shows the first screenful and the page
// grows under it the same way the real roster will.
const SKELETON_ROSTER_ROWS = 6;

function ClanLoading({ busyRetrying }: ClanLoadingProps) {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createClanLoadingStyles(theme), [theme]);
  const pulse = useSkeletonPulse();
  // The same presentation switch the roster itself uses (NFR-05): table
  // rows at 768 px and up, cards below it, so the skeleton holds the exact
  // shape the data will fill on this viewport. The detail card's two
  // columns follow the same line.
  const { width } = useWindowDimensions();
  const breakpoint = breakpointFor(width);
  const isCardPresentation = breakpoint === 'small' || breakpoint === 'mobile';
  const twoColumns = breakpoint === 'tablet' || breakpoint === 'desktop';

  return (
    <>
      <View style={[base.panelRaised, styles.detailPanel]}>
        <View style={styles.identityWrap} accessibilityRole="progressbar" accessibilityLabel="Loading clan">
          <View style={styles.identityRow}>
            <SkeletonBlock
              width={SKELETON_BADGE_SLOT}
              height={SKELETON_BADGE_SLOT}
              radiusStep={2}
              pulse={pulse}
            />
            <View style={styles.identityText}>
              <SkeletonBlock width={SKELETON_NAME_WIDTH} height={theme.fontSize.xl} pulse={pulse} />
              <SkeletonBlock width={SKELETON_META_WIDTH} height={theme.fontSize.xs} pulse={pulse} />
            </View>
          </View>
          <SkeletonBlock
            width="100%"
            height={Math.round(theme.lineHeight.normal * theme.fontSize.sm) * 2}
            pulse={pulse}
          />
          <View style={styles.statDivider} aria-hidden />
          <View style={styles.statGrid}>
            {Array.from({ length: SKELETON_STAT_CELLS }, (_, index) => (
              <View
                key={index}
                style={[styles.statCell, twoColumns ? styles.statCellQuarter : styles.statCellHalf]}
              >
                <SkeletonBlock width="70%" height={theme.fontSize.xs} pulse={pulse} />
                <SkeletonBlock width="50%" height={theme.fontSize.sm} pulse={pulse} />
              </View>
            ))}
          </View>
          <Text style={[base.caption, styles.caption]}>
            {busyRetrying
              ? 'The game API is busy. One moment, retrying automatically…'
              : 'Fetching through the tier…'}
          </Text>
        </View>
      </View>

      {/* The tab bar's own shape, so the pills do not pop in after data. */}
      <View style={styles.tabBar} aria-hidden>
        {['roster', 'war', 'log', 'attention'].map((id) => (
          <View key={id} style={styles.tabCell}>
            <SkeletonBlock width="55%" height={theme.fontSize.sm} pulse={pulse} />
          </View>
        ))}
      </View>

      {isCardPresentation ? (
        <View
          style={styles.rosterCards}
          accessibilityRole="progressbar"
          accessibilityLabel="Loading the clan roster"
        >
          {Array.from({ length: SKELETON_ROSTER_ROWS }, (_, index) => (
            <SkeletonCard key={index} />
          ))}
        </View>
      ) : (
        <View
          style={styles.rosterPanel}
          accessibilityRole="progressbar"
          accessibilityLabel="Loading the clan roster"
        >
          <View style={styles.rosterHeaderRow}>
            <SkeletonBlock width="45%" height={theme.fontSize.xs} pulse={pulse} />
          </View>
          {Array.from({ length: SKELETON_ROSTER_ROWS }, (_, index) => (
            <View key={index} style={styles.rosterRow}>
              <SkeletonBlock width="100%" height={theme.fontSize.sm} pulse={pulse} />
            </View>
          ))}
        </View>
      )}
    </>
  );
}

// ---------- error ----------

interface ClanErrorProps {
  error: ClanFetchError | Error;
  onRetry: () => void;
  onSearch: () => void;
  isRetrying: boolean;
  tag: string;
}

function ClanError({ error, onRetry, onSearch, isRetrying, tag }: ClanErrorProps) {
  // The contract (04 section 6) gives the clan route four real states:
  // not_found, upstream_busy, upstream_unreachable, and bad_request (a
  // malformed tag). Each gets its own copy and a next action, never a dead
  // end (06 section 3). The retry action is shared; the not_found branch
  // surfaces "search clans" as its own primary action since retry cannot
  // fix a retired tag, and the breadcrumbs above already carry the way
  // back. The not_found body carries the tag-correction hint the state
  // matrix asks for: what a well-formed tag looks like, so a typo'd URL
  // can be fixed by hand.
  if (error instanceof ClanFetchError) {
    const result = error.result;
    if (result.kind === 'not_found') {
      return (
        <ErrorState
          tone="gone"
          title="No clan with this tag"
          body={`The tag ${tag} did not resolve. The clan was retired, or the tag has a typo: tags are 3 to 20 letters and numbers after the #. Search the clan by name instead.`}
          action={<PillButton label="Search clans" role="link" arrow onPress={onSearch} />}
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
      body={error.message || 'An unexpected error happened while fetching the clan.'}
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

// ---------- tab bar button ----------

interface TabButtonProps {
  label: string;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}

function TabButton({ label, active, onPress, styles }: TabButtonProps) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      // aria-selected directly, not accessibilityState: react-native-web
      // 0.20 does not map accessibilityState onto aria attributes, the
      // same gap the needs-attention switch had (session 22), so the tab
      // would never announce which pane is active.
      aria-selected={active}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tabButton,
        active && styles.tabButtonActive,
        pressed && styles.tabButtonPressed,
      ]}
    >
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

// ---------- roster tab (T-M1-4, FR-04, SR-11, NFR-05) ----------

// ---------- card sort bar ----------

// The card presentation (below 768 px) has no column headers to press, so
// the same six sortable columns surface as the kit's select-style control
// (07 section 4): a "Sort members by" dropdown plus a direction toggle.
// FR-04 carries no width qualifier, so a phone gets the same six sorts the
// table does, through the same rules: what either control means for the
// row order lives in lib/roster-sort.ts next to the table's header cycle,
// and both presentations drive the one sort state RosterSection owns.
// Option labels read the FR-04 column names in full (the table headers
// stay terse because their meaning is positional).
const SORT_OPTIONS: ReadonlyArray<{ label: string; value: RosterSortSelection }> = [
  { label: 'Clan order', value: 'clan' },
  { label: 'Role', value: 'role' },
  { label: 'Town Hall', value: 'townHall' },
  { label: 'Trophies', value: 'trophies' },
  { label: 'Donations given', value: 'donations' },
  { label: 'Donations received', value: 'received' },
  { label: 'XP', value: 'xp' },
];

interface RosterCardSortBarProps {
  /** The sort the roster is currently rendered in. */
  sort: RosterSortState;
  /** The one setter both controls drive; the lib rules decide the next state. */
  onChange: (next: RosterSortState) => void;
}

function RosterCardSortBar({ sort, onChange }: RosterCardSortBarProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createSortBarStyles(theme), [theme]);
  // "Clan order" is the dropdown's reset option; it maps to the null key.
  const selection: RosterSortSelection = sort.key ?? 'clan';
  return (
    <View style={styles.sortBar}>
      <View style={styles.sortBarDropdown}>
        <Dropdown
          label="Sort members by"
          options={SORT_OPTIONS}
          value={selection}
          onSelect={(next) => onChange(rosterSortForSelection(next, sort))}
        />
      </View>
      <PillButton
        label={sort.direction === 'asc' ? 'Ascending' : 'Descending'}
        onPress={() => onChange(flipRosterSortDirection(sort))}
        variant="secondary"
        disabled={sort.key === null}
        hint="Flips the sort direction of the picked column."
      />
    </View>
  );
}

interface RosterSectionProps {
  members: ClanMember[];
}

function RosterSection({ members }: RosterSectionProps) {
  const navigate = useNavigate();
  // Tap-through goes through the one tag module (SR-13) so the URL is
  // built exactly like every other player link in the app.
  const openMember = (tag: string) => {
    navigate(playerRouteFor(tag));
  };

  // Sort is view state, not route state (the URL map documents only ?tab=),
  // so it lives here in useState and resets when the visitor leaves the
  // screen. The ordering rule itself is lib/roster-sort.ts, pure and tested.
  // The needs-attention view is its own tab now, so the roster's sort is
  // always in effect and its controls never disable.
  const [sort, setSort] = useState<RosterSortState>(CLAN_ORDER);
  // The presentation switch (NFR-05): a real table at 768 px and up, one
  // card per member below it. Read through useWindowDimensions into the
  // breakpoints helper, never CSS media queries (07 section 3).
  const { width } = useWindowDimensions();
  const breakpoint = breakpointFor(width);
  const isCardPresentation = breakpoint === 'small' || breakpoint === 'mobile';

  const sortedMembers = useMemo(() => sortRoster(members, sort), [members, sort]);

  const handleColumnPress = (key: RosterSortKey) => {
    setSort((previous) => nextRosterSortState(key, previous));
  };

  // A clan always carries at least one member in a healthy payload; an
  // empty roster is the designed empty state, not an error (06 section 3).
  if (sortedMembers.length === 0) {
    return (
      <EmptyState
        title="No members to show"
        body="The clan data came back without any member rows. That is unusual for a live clan; heading back to search and reopening the clan usually clears it."
        action={
          <PillButton
            label="Back to search"
            role="link"
            arrow
            variant="secondary"
            onPress={() => navigate('/clans')}
          />
        }
      />
    );
  }

  return isCardPresentation ? (
    // The card presentation has no column headers, so the sort rides in
    // the bar above the list. The cards render in page flow like the
    // table rows: the browser scrollbar owns the scrolling (07 section
    // 3), so the roster runs as long as it runs instead of boxing the
    // visitor into a four-card inner scroll window.
    <>
      <RosterCardSortBar sort={sort} onChange={setSort} />
      {sortedMembers.map((member) => (
        <RosterCard key={member.tag} member={member} onPress={openMember} />
      ))}
    </>
  ) : (
    <RosterTable
      members={sortedMembers}
      sort={sort}
      onPressColumn={handleColumnPress}
      onPressMember={openMember}
    />
  );
}

// ---------- needs attention tab (FR-05, SR-12, AC-02) ----------

interface AttentionSectionProps {
  members: ClanMember[];
  /** Attacks each member still holds in the current war; null renders the
   * dash. Owned by the screen (the war query lives beside the clan query). */
  attacksLeft: (memberTag: string) => number | null;
  /** The quiet line explaining why attacks left may show dashes; null when
   * the war data says something worth showing. */
  warNote: string | null;
}

function AttentionSection({ members, attacksLeft, warNote }: AttentionSectionProps) {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const openMember = (tag: string) => {
    navigate(playerRouteFor(tag));
  };

  // The tab is a fresh view per visit: the target (and the ratio boxes'
  // drafts inside the input) start from the 1:1 default every time the
  // visitor opens the tab, because the boxes only mount here and a draft
  // pair cannot be re-derived from the float target without lying (the
  // same call session 24 made, now scoped to the tab).
  const [target, setTarget] = useState<DonationTarget>(DEFAULT_DONATION_TARGET);

  // The donation balance is computed from the same members the roster
  // holds (SR-09: one fetch, no per-member requests). Pure, so it
  // re-computes locally when the target changes without any refetch (SR-12).
  const balance = useMemo(() => computeDonationBalance(members, target), [members, target]);

  // Worst-first order from the engine, the tab's whole point (FR-05).
  const ordered = useMemo(() => sortNeedsAttention(members, target), [members, target]);

  // A verdict lookup by tag so each row finds its chip in O(n) without the
  // table re-indexing. Built once per balance change.
  const verdictByTag = useMemo(() => {
    const map = new Map<string, DonationVerdict>();
    for (const verdict of balance.verdicts) {
      map.set(verdict.member.tag, verdict);
    }
    return map;
  }, [balance]);

  const { width } = useWindowDimensions();
  const breakpoint = breakpointFor(width);
  const isCardPresentation = breakpoint === 'small' || breakpoint === 'mobile';

  if (ordered.length === 0) {
    return (
      <EmptyState
        title="No members to show"
        body="The clan data came back without any member rows. That is unusual for a live clan; heading back to search and reopening the clan usually clears it."
        action={
          <PillButton
            label="Back to search"
            role="link"
            arrow
            variant="secondary"
            onPress={() => navigate('/clans')}
          />
        }
      />
    );
  }

  return (
    <>
      <AttentionControls summary={balance.summary} onSelectTarget={setTarget} />
      {warNote !== null ? <Text style={attentionNoteStyle(theme)}>{warNote}</Text> : null}
      {isCardPresentation ? (
        ordered.map((member, index) => (
          <AttentionCard
            key={member.tag}
            member={member}
            position={index + 1}
            verdict={verdictByTag.get(member.tag)}
            attacksLeft={attacksLeft(member.tag)}
            onPress={openMember}
          />
        ))
      ) : (
        <AttentionTable
          members={ordered}
          verdictByTag={verdictByTag}
          attacksLeft={attacksLeft}
          onPressMember={openMember}
        />
      )}
    </>
  );
}

// ---------- attention controls ----------

interface AttentionControlsProps {
  summary: ReturnType<typeof computeDonationBalance>['summary'];
  onSelectTarget: (target: DonationTarget) => void;
}

// The controls row the Needs Attention tab renders above its table: the
// donation ratio's two number boxes (the target, SR-12) and the health
// readout. The needs-attention switch is gone with the toggle era, the
// tab itself is the switch now, so the boxes are always live here and the
// disable-not-hide dance retired with them.
function AttentionControls({ summary, onSelectTarget }: AttentionControlsProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createDonationBarStyles(theme), [theme]);
  const healthText =
    summary.healthShare === null
      ? '\u2014'
      : `${Math.round(summary.healthShare * 100)}% at target`;
  const flaggedText =
    summary.membersWithData === 0
      ? 'no donation data'
      : `${summary.flagged} flagged of ${summary.membersWithData}`;
  return (
    <View style={styles.controlBar}>
      <DonationRatioInput onSelectTarget={onSelectTarget} styles={styles} />
      <Text style={styles.healthLabel}>{healthText}</Text>
      <Text style={styles.healthLabel}>{flaggedText}</Text>
    </View>
  );
}

// ---------- donation ratio input ----------

interface DonationRatioInputProps {
  onSelectTarget: (target: DonationTarget) => void;
  styles: ReturnType<typeof createDonationBarStyles>;
}

// The donation ratio input: two number boxes, "__ : __", the target ratio
// written as given : received (SR-12's adjustable target). This replaces
// the preset chip row (0.5 / 1:1 / 1.5 / 2.0) on the owner's call: a free
// two-number ratio says exactly what the visitor means ("1 : 2" is give
// half, "3 : 2" is give 1.5x) without reading a legend of decimals. The
// drafts start at "1"/"1", mirroring DEFAULT_DONATION_TARGET's 1:1; the
// parsed pair is the only writer of the target, so the boxes never drift
// from what the engine runs with.
function DonationRatioInput({ onSelectTarget, styles }: DonationRatioInputProps) {
  const [givenDraft, setGivenDraft] = useState('1');
  const [receivedDraft, setReceivedDraft] = useState('1');

  // The pair parses as soon as both sides hold a whole number and the
  // received side is at least 1 ("give 1 for every 0 received" is not a
  // ratio). An empty or invalid box keeps the last valid target, so
  // clearing a box mid-edit never flickers the roster.
  const apply = (nextGiven: string, nextReceived: string) => {
    const given = parseRatioSide(nextGiven);
    const received = parseRatioSide(nextReceived);
    if (given === null || received === null || received < 1) return;
    onSelectTarget(given / received);
  };

  return (
    <View style={styles.ratioBox}>
      <Text style={styles.ratioLabel}>Donation ratio</Text>
      <View style={styles.ratioRow}>
        <TextInput
          value={givenDraft}
          onChangeText={(text) => {
            setGivenDraft(text);
            apply(text, receivedDraft);
          }}
          accessibilityLabel="Donation ratio, given side"
          accessibilityHint="How many troops the member should give. The roster re-computes locally, no refetch."
          keyboardType="numeric"
          maxLength={3}
          style={styles.ratioInput}
        />
        <Text style={styles.ratioColon} aria-hidden>
          :
        </Text>
        <TextInput
          value={receivedDraft}
          onChangeText={(text) => {
            setReceivedDraft(text);
            apply(givenDraft, text);
          }}
          accessibilityLabel="Donation ratio, received side"
          accessibilityHint="For every this many troops received. Must be at least one."
          keyboardType="numeric"
          maxLength={3}
          style={styles.ratioInput}
        />
      </View>
    </View>
  );
}

/** One side of the ratio: 1 to 3 digits, a whole number, 0 or more. Returns
 * null for anything else (empty box mid-edit, pasted junk). */
function parseRatioSide(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  return Number.parseInt(trimmed, 10);
}

// ---------- tab content placeholder ----------

interface TabPlaceholderProps {
  tab: Exclude<ClanTab, 'roster' | 'attention'>;
}

function TabPlaceholder({ tab }: TabPlaceholderProps) {
  // The War and Log views land in M3. The placeholder is designed (06
  // section 3 "empty"): titled, explained, and pointing at the milestone
  // that fills it, so the screen reads end to end today and a reviewer
  // knows what is missing by design rather than by oversight.
  if (tab === 'war') {
    return (
      <EmptyState
        title="War view lands in M3"
        body="The current war view (state banner, both clans, per-member attack table) and the preparation-day scouting view land in milestone M3, alongside the war log."
      />
    );
  }
  return (
    <EmptyState
      title="War log lands in M3"
      body="The war log (result chips, efficiency summary, and the designed private-log notice) lands in milestone M3 with the current war view."
    />
  );
}

// ---------- styles ----------

// The card sort bar's own styles (STD-13): it builds them from the theme
// like any component, never receives a screen stylesheet as a prop. The
// roster itself needs no styles anymore: it renders in page flow (no
// scroll container to flex), and its pieces own theirs.
function createSortBarStyles(t: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    // The sort bar rides above the card list. Bottom-aligned so the
    // direction pill lines up with the dropdown's trigger, not its
    // micro label; wraps at the 360 px floor so the pill never squeezes
    // the trigger's value text.
    sortBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      flexWrap: 'wrap',
      columnGap: t.spacing[3],
      rowGap: t.spacing[2],
      marginBottom: t.spacing[3],
    },
    sortBarDropdown: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 180,
      minWidth: 0,
    },
  });
}

// The attention controls' own styles (STD-13). Quiet chrome: a flat row,
// not a raised panel, so the attention table keeps the visual weight.
function createDonationBarStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    controlBar: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      columnGap: t.spacing[4],
      rowGap: t.spacing[2],
      marginBottom: t.spacing[3],
    },
    // The "Donation ratio" two-number box. Label whispers on top, the
    // "__ : __" row speaks under it, the same label-value rhythm every
    // other control in the kit uses.
    ratioBox: {
      gap: t.spacing[1],
    },
    ratioLabel: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    ratioRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing[2],
    },
    ratioInput: {
      width: 56,
      minHeight: t.layout.touchTargetMin,
      paddingHorizontal: t.spacing[2],
      borderRadius: t.radius[1],
      borderWidth: 1,
      borderColor: c.panelBorderStrong,
      backgroundColor: c.panelRaised,
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.md,
      color: c.textPrimary,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    ratioColon: {
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.md,
      color: c.textMuted,
    },
    healthLabel: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textMuted,
      fontVariant: ['tabular-nums'],
    },
  });
}

// The war note under the controls: a quiet caption, not an error state,
// because the war fetch is supplementary to the tab (the clan fetch owns
// the state matrix).
function attentionNoteStyle(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    note: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textMuted,
      marginBottom: t.spacing[3],
    },
  }).note;
}

// The loading skeleton's own styles (STD-13, the RosterSection pattern).
// Each block mirrors the success element it stands in for; the mirror is
// the point (layout-matched, 06 section 3), so a change to the success
// layout is a change here in the same PR. Updated with the stacked detail
// card: identity row, description, hairline, stat grid, four tab cells.
function createClanLoadingStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    // Mirrors the detail panel's own gap.
    detailPanel: {
      gap: t.spacing[5],
    },
    // Mirrors the success wrap's stack and gap.
    identityWrap: {
      gap: t.spacing[5],
    },
    // Mirrors the identity row: badge slot beside the name/meta column.
    identityRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: t.spacing[4],
    },
    identityText: {
      flex: 1,
      gap: t.spacing[1],
      minWidth: 0,
    },

    // Mirrors the hairline between the description and the stat grid, and
    // the grid itself: the same wrap, gaps, and cell bases the success
    // state renders so the skeleton holds the exact cell positions.
    statDivider: {
      height: 1,
      backgroundColor: c.hairline,
    },
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
    statCellQuarter: {
      flexBasis: '22%',
    },
    statCellHalf: {
      flexBasis: '46%',
    },
    caption: {
      marginTop: t.spacing[1],
    },

    // Mirrors the real tab bar's container and compact strip.
    tabBar: {
      flexDirection: 'row',
      gap: t.spacing[1],
      marginTop: t.spacing[4],
      padding: t.spacing[1],
      backgroundColor: c.panel,
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorder,
    },
    tabCell: {
      flex: 1,
      paddingVertical: t.spacing[2],
      alignItems: 'center',
      justifyContent: 'center',
    },

    // The table-shaped roster skeleton: a panel like RosterTable's, with a
    // header row and body rows at the same row height the real rows keep.
    rosterPanel: {
      marginTop: t.spacing[4],
      backgroundColor: c.panelRaised,
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorder,
      overflow: 'hidden',
    },
    rosterHeaderRow: {
      minHeight: t.layout.touchTargetMin,
      paddingHorizontal: t.spacing[3],
      justifyContent: 'center',
      borderBottomWidth: 1,
      borderBottomColor: c.panelBorder,
    },
    rosterRow: {
      minHeight: t.layout.touchTargetMin,
      paddingHorizontal: t.spacing[3],
      justifyContent: 'center',
      borderBottomWidth: 1,
      borderBottomColor: c.hairline,
    },

    // The card-shaped roster skeleton below 768 px: the same gap the real
    // card list's marginBottom rhythm keeps.
    rosterCards: {
      marginTop: t.spacing[4],
      gap: t.spacing[3],
    },
  });
}

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    column: {
      flex: 1,
    },
    // The crumbs sit a full step above the details card (the owner's
    // "too near the card" note); the wrap owns that distance so the
    // loading and error states keep it too.
    breadcrumbWrap: {
      marginBottom: t.spacing[4],
    },
    detailPanel: {
      gap: t.spacing[5],
    },

    // success: the stacked details card. The identity row (badge, name,
    // tag/level/location line), the description under it, a hairline, and
    // the uniform stat grid: 4 cells per row from tablet up, 2 below. The
    // cells flex within their row so the grid stays even at any width.
    successWrap: {
      gap: t.spacing[5],
    },
    identityRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: t.spacing[4],
    },
    identityText: {
      flex: 1,
      gap: t.spacing[1],
      minWidth: 0,
    },
    tagLine: {
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.sm,
      color: c.textMuted,
    },
    identityMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      columnGap: t.spacing[2],
      rowGap: t.spacing[1],
    },
    levelChip: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.semibold,
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    metaDot: {
      fontSize: t.fontSize.xs,
      color: c.hairline,
    },
    locationLine: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    // The badge slot (07 section 7): 48 px, the size the design language
    // documents for API badges.
    badge: {
      width: 48,
      height: 48,
      borderRadius: t.radius[2],
      backgroundColor: c.panel,
    },
    badgePlaceholder: {
      width: 48,
      height: 48,
      borderRadius: t.radius[2],
      backgroundColor: c.hairline,
    },
    description: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      lineHeight: Math.round(t.lineHeight.normal * t.fontSize.sm),
      color: c.textMuted,
    },

    // the uniform stat grid: one flat wrap of label-above-value cells
    statDivider: {
      height: 1,
      backgroundColor: c.hairline,
    },
    statGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: t.spacing[4],
      rowGap: t.spacing[4],
    },
    // The basis sits under a half row so the wrap lands on even columns
    // (4 up, 2 below) while flexGrow fills each line to the edges.
    statCell: {
      flexGrow: 1,
      flexShrink: 1,
      gap: t.spacing[1],
    },
    statCellQuarter: {
      flexBasis: '22%',
    },
    statCellHalf: {
      flexBasis: '46%',
    },
    statLabel: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    statValue: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
      fontVariant: ['tabular-nums'],
    },

    // tab bar: a deliberately compact strip (the owner's call to shave the
    // height): padding-driven, no touch-target floor. It is the one
    // recorded exception to 07 section 6's 44 px floor, keyboard focus and
    // the visible ring still apply.
    tabBar: {
      flexDirection: 'row',
      gap: t.spacing[1],
      marginTop: t.spacing[4],
      padding: t.spacing[1],
      backgroundColor: c.panel,
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorder,
    },
    tabButton: {
      flex: 1,
      paddingVertical: t.spacing[2],
      paddingHorizontal: t.spacing[3],
      borderRadius: t.radius[1],
      alignItems: 'center',
      justifyContent: 'center',
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    tabButtonActive: {
      backgroundColor: c.panelRaised,
    },
    tabButtonPressed: {
      opacity: 0.7,
    },
    tabLabel: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.medium,
      color: c.textMuted,
    },
    tabLabelActive: {
      color: c.textPrimary,
      fontWeight: t.fontWeight.semibold,
    },

    // tab content: natural height. The roster renders in page flow and the
    // browser scrollbar owns the scrolling (07 section 3), so this region
    // grows as tall as the roster runs and pushes the footer down with it.
    tabContent: {
      marginTop: t.spacing[4],
    },

    // footer: the fetch age only. The back-to-search button retired with
    // the breadcrumbs, which carry the way back (the owner's call).
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
