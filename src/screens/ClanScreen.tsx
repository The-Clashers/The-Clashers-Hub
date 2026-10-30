import { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useParams, useSearchParams, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTheme, createBaseStyles, breakpointFor } from '../theme';
import { ThemeToggle } from '../components/ThemeToggle';
import StatChip from '../components/StatChip';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import PillButton from '../components/PillButton';
import RosterTable from '../components/RosterTable';
import RosterCard from '../components/RosterCard';
import SkeletonCard from '../components/Skeleton';
import SkeletonBlock, { useSkeletonPulse } from '../components/SkeletonBlock';
import Dropdown from '../components/Dropdown';
import { fetchClan, ClanFetchError, type ClanMember } from '../api/clan';
import { busyRetryDelayMs, shouldRetryBusy } from '../lib/busy-retry';
import { warFrequencyLabel } from '../lib/war-frequency';
import { playerRouteFor } from '../lib/tag';
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
// the search bar's #tag path both land here. The screen owns layout and the
// route's state; the pieces it renders come from the shared kit (07 section 4):
// StatChip for the stat row, ErrorState for the contract's three failure
// kinds, EmptyState for the designed "this tab lands later" placeholder,
// PillButton for the retry and back-to-search actions, ThemeToggle for the
// header, RosterTable and RosterCard for the Roster tab (T-M1-4). Every
// state the design language requires is designed (06 section 3): a
// layout-matched loading skeleton, the contract's three error states
// (not_found, busy, unreachable) plus bad_request, and the success state
// with the identity block, the stat chips, the tab bar, and the roster.
//
// The tab bar reads `?tab=` from the URL (03 section 2 "Screens & URLs") so a
// deep link to the War or Log tab is shareable (F-12). Roster is the default
// when the param is absent or holds an unknown value. The War and Log tabs
// keep their designed placeholders until M3; the Roster tab renders the real
// roster from the same single clan fetch (SR-09).

// ---------- tab bar ----------

/** The three tabs the clan detail screen renders, in order. */
type ClanTab = 'roster' | 'war' | 'log';

const TABS: ReadonlyArray<{ id: ClanTab; label: string }> = [
  { id: 'roster', label: 'Roster' },
  { id: 'war', label: 'War' },
  { id: 'log', label: 'Log' },
];

/** Maps a raw ?tab= value to a known tab, defaulting to Roster. Unknown
 * values fall back to the default so a stale or typo'd deep link still lands
 * on a real tab instead of an empty content area. */
function tabFromValue(raw: string | null): ClanTab {
  if (raw === 'war' || raw === 'log') return raw;
  return 'roster';
}

// The client staleTime mirrors the tier's 180 s clan TTL (SR-09) so the two
// cache layers decay together, the same pairing the hello screen uses.
const CLAN_STALE_TIME_MS = 180_000;

// The roster region's height floor: small enough that the identity block
// and stat row keep their room on a laptop, tall enough that the roster's
// own scroll window stays usable (about six rows). Below it the page grows
// instead, the same trade the search screen's results area makes.
const ROSTER_REGION_MIN_HEIGHT = 320;

export default function ClanScreen() {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const tag = params.tag ?? '';
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

  return (
    <View style={base.appRoot}>
      <View style={base.screen}>
        <View style={[base.contentColumn, styles.column]}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={base.micro}>Clan</Text>
              <Text style={base.display}>{query.data?.name ?? 'Clan detail'}</Text>
            </View>
            <ThemeToggle />
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
                    onSearch={() => navigate('/')}
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
                  ) : (
                    <TabPlaceholder tab={activeTab} />
                  )}
                </View>
              ) : null}
            </>
          )}

          <View style={styles.footer}>
            <PillButton
              label="Back to search"
              role="link"
              arrow
              variant="secondary"
              onPress={() => navigate('/')}
              hint="Returns to the clan search screen."
            />
            {query.isSuccess ? (
              <Text style={base.caption}>fetched {query.data.age}s ago</Text>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

// ---------- success: identity header + stat chips ----------

interface ClanSuccessProps {
  clan: Awaited<ReturnType<typeof fetchClan>>;
  base: ReturnType<typeof createBaseStyles>;
  styles: ReturnType<typeof createStyles>;
}

function ClanSuccess({ clan, base, styles }: ClanSuccessProps) {
  // The badge is an API icon (07 section 7), rendered through RN Image in a
  // fixed slot so a slow CDN load never reflows the identity block. A missing
  // badge gets a quiet block instead, never a broken-image glyph.
  const badgeUri = clan.badgeUrls?.medium || clan.badgeUrls?.small;
  const locationName = clan.location?.name ?? 'No location';
  const requirements: ReadonlyArray<{ label: string; value: string }> = [
    { label: 'Trophies', value: String(clan.requirements.requiredTrophies) },
    ...(clan.requirements.requiredTownhallLevel !== undefined
      ? [{ label: 'Town Hall', value: `TH ${clan.requirements.requiredTownhallLevel}` }]
      : []),
    { label: 'War', value: warFrequencyLabel(clan.requirements.warFrequency) },
  ];

  return (
    <View style={styles.successWrap} accessibilityLabel={`${clan.name} clan detail`}>
      <View style={styles.identity}>
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
          <Text style={base.title} numberOfLines={2}>
            {clan.name}
          </Text>
          <Text style={styles.tagLine}>{clan.tag}</Text>
          <View style={styles.identityMeta}>
            <Text style={styles.levelChip}>Level {clan.clanLevel}</Text>
            <Text style={styles.metaDot} aria-hidden>
              {'  |  '}
            </Text>
            <Text style={styles.locationLine}>{locationName}</Text>
          </View>
        </View>
      </View>

      {clan.description ? (
        <Text style={styles.description} numberOfLines={6}>
          {clan.description}
        </Text>
      ) : null}

      <View style={styles.requirementsBlock}>
        <Text style={styles.requirementsLabel}>Requirements</Text>
        <View style={styles.requirementsRow}>
          {requirements.map((req) => (
            <View key={req.label} style={styles.requirementChip}>
              <Text style={styles.requirementChipLabel}>{req.label}</Text>
              <Text style={styles.requirementChipValue} numberOfLines={1}>
                {req.value}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.statRow}>
        <StatChip label="Members" value={String(clan.members)} />
        <StatChip label="Win streak" value={String(clan.warWinStreak)} />
        <StatChip label="War wins" value={String(clan.warWins)} />
        <StatChip label="Points" value={String(clan.clanPoints)} />
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
// this follows in the same PR.

// The identity block's fixed badge slot (the success state renders the
// API badge at this size, 07 section 7).
const SKELETON_BADGE_SLOT = 64;

// Line widths chosen to read as a name, a tag, and a meta line; the
// requirement and stat chips mirror the label/value pairs they stand in
// for.
const SKELETON_NAME_WIDTH = 220;
const SKELETON_TAG_WIDTH = 140;
const SKELETON_META_WIDTH = 180;
const SKELETON_REQ_LABEL_WIDTH = 64;
const SKELETON_REQ_VALUE_WIDTH = 80;
const SKELETON_STAT_LABEL_WIDTH = 72;
const SKELETON_STAT_VALUE_WIDTH = 56;

// Enough roster rows to fill the roster region's floor (about six rows
// plus the header), the same count a laptop viewport shows.
const SKELETON_ROSTER_ROWS = 6;

function ClanLoading({ busyRetrying }: ClanLoadingProps) {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createClanLoadingStyles(theme), [theme]);
  const pulse = useSkeletonPulse();
  // The same presentation switch the roster itself uses (NFR-05): table
  // rows at 768 px and up, cards below it, so the skeleton holds the exact
  // shape the data will fill on this viewport.
  const { width } = useWindowDimensions();
  const breakpoint = breakpointFor(width);
  const isCardPresentation = breakpoint === 'small' || breakpoint === 'mobile';

  return (
    <>
      <View style={[base.panelRaised, styles.detailPanel]}>
        <View
          style={styles.identityWrap}
          accessibilityRole="progressbar"
          accessibilityLabel="Loading clan"
        >
          <View style={styles.identity}>
            <SkeletonBlock
              width={SKELETON_BADGE_SLOT}
              height={SKELETON_BADGE_SLOT}
              radiusStep={3}
              pulse={pulse}
            />
            <View style={styles.identityText}>
              <SkeletonBlock width={SKELETON_NAME_WIDTH} height={theme.fontSize.xl} pulse={pulse} />
              <SkeletonBlock width={SKELETON_TAG_WIDTH} height={theme.fontSize.sm} pulse={pulse} />
              <SkeletonBlock width={SKELETON_META_WIDTH} height={theme.fontSize.xs} pulse={pulse} />
            </View>
          </View>
          <SkeletonBlock
            width="100%"
            height={Math.round(theme.lineHeight.relaxed * theme.fontSize.body) * 2}
            pulse={pulse}
          />
          <View style={styles.requirementsRow}>
            {[0, 1, 2].map((index) => (
              <View key={index} style={styles.requirementChip}>
                <SkeletonBlock
                  width={SKELETON_REQ_LABEL_WIDTH}
                  height={theme.fontSize.xs}
                  pulse={pulse}
                />
                <SkeletonBlock
                  width={SKELETON_REQ_VALUE_WIDTH}
                  height={theme.fontSize.sm}
                  pulse={pulse}
                />
              </View>
            ))}
          </View>
          <View style={styles.statRow}>
            {[0, 1, 2, 3].map((index) => (
              <View key={index} style={styles.statCell}>
                <SkeletonBlock
                  width={SKELETON_STAT_LABEL_WIDTH}
                  height={theme.fontSize.xs}
                  pulse={pulse}
                />
                <SkeletonBlock
                  width={SKELETON_STAT_VALUE_WIDTH}
                  height={theme.fontSize.sm}
                  pulse={pulse}
                />
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
        {['roster', 'war', 'log'].map((id) => (
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
  // end (06 section 3). The retry action is shared; the back-to-search
  // action sits in the screen footer for every state, so the not_found
  // branch surfaces "search by name" as its own primary action since retry
  // cannot fix a retired tag. The not_found body carries the tag-correction
  // hint the state matrix asks for: what a well-formed tag looks like, so a
  // typo'd URL can be fixed by hand.
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
      accessibilityState={{ selected: active }}
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

// The card list keeps the search screen's virtualization tuning: cards are
// the cheaper row, so a smaller initial window still fills a phone screen.
const INITIAL_CARDS_TO_RENDER = 8;
const CARDS_PER_BATCH = 12;

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
  /** While the needs-attention view owns the row order, the column sort is
   * not in effect, so both controls disable rather than lie about it. */
  disabled: boolean;
}

function RosterCardSortBar({ sort, onChange, disabled }: RosterCardSortBarProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createRosterStyles(theme), [theme]);
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
          disabled={disabled}
        />
      </View>
      <PillButton
        label={sort.direction === 'asc' ? 'Ascending' : 'Descending'}
        onPress={() => onChange(flipRosterSortDirection(sort))}
        variant="secondary"
        disabled={disabled || sort.key === null}
        hint="Flips the sort direction of the picked column."
      />
    </View>
  );
}

// Preset target ratios for the donation balance control (SR-12). A small
// closed set keeps the control a chip row, not a free-form input; 0.5
// means "give at least half", 2.0 means "give double". The default is 1:1.
const TARGET_OPTIONS: ReadonlyArray<{ label: string; value: DonationTarget }> = [
  { label: '0.5', value: 0.5 },
  { label: '1:1', value: 1.0 },
  { label: '1.5', value: 1.5 },
  { label: '2.0', value: 2.0 },
];

interface RosterSectionProps {
  members: ClanMember[];
}

function RosterSection({ members }: RosterSectionProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createRosterStyles(theme), [theme]);
  const navigate = useNavigate();
  // Tap-through goes through the one tag module (SR-13) so the URL is
  // built exactly like every other player link in the app.
  const openMember = (tag: string) => {
    navigate(playerRouteFor(tag));
  };

  // Sort is view state, not route state (the URL map documents only ?tab=),
  // so it lives here in useState and resets when the visitor leaves the
  // screen. The ordering rule itself is lib/roster-sort.ts, pure and tested.
  const [sort, setSort] = useState<RosterSortState>(CLAN_ORDER);
  // The needs-attention toggle (FR-05, SR-12, AC-02). When on, the roster
  // re-orders worst-first by donation deficit and every flagged row shows
  // the RatioFlag chip. The target is adjustable client-side (SR-12): the
  // engine is a pure function, so changing the target is a re-call with the
  // same members, no refetch.
  const [needsAttention, setNeedsAttention] = useState(false);
  const [target, setTarget] = useState<DonationTarget>(DEFAULT_DONATION_TARGET);
  // The presentation switch (NFR-05): a real table at 768 px and up, one
  // card per member below it. Read through useWindowDimensions into the
  // breakpoints helper, never CSS media queries (07 section 3).
  const { width } = useWindowDimensions();
  const breakpoint = breakpointFor(width);
  const isCardPresentation = breakpoint === 'small' || breakpoint === 'mobile';

  // The donation balance is computed from the same members the roster
  // already holds (SR-09: one fetch, no per-member requests). Pure, so it
  // re-computes locally when the target changes without any refetch (SR-12).
  const balance = useMemo(
    () => computeDonationBalance(members, target),
    [members, target],
  );

  const sortedMembers = useMemo(() => {
    if (needsAttention) {
      return sortNeedsAttention(members, target);
    }
    return sortRoster(members, sort);
  }, [members, sort, needsAttention, target]);

  // A verdict lookup by tag so each row finds its chip in O(n) without the
  // table re-indexing. Built once per balance change.
  const verdictByTag = useMemo(() => {
    const map = new Map<string, DonationVerdict>();
    for (const verdict of balance.verdicts) {
      map.set(verdict.member.tag, verdict);
    }
    return map;
  }, [balance]);

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
            onPress={() => navigate('/')}
          />
        }
      />
    );
  }

  return (
    <View style={styles.rosterWrap}>
      <DonationControlBar
        needsAttention={needsAttention}
        onToggleNeedsAttention={() => setNeedsAttention((previous) => !previous)}
        target={target}
        onSelectTarget={setTarget}
        summary={balance.summary}
        styles={styles}
      />
      {isCardPresentation ? (
        // The card presentation has no column headers, so the sort rides in
        // the bar above the list (the wrapper View around the FlatList keeps
        // the same flex contract the table's grid wrapper documents). While
        // the needs-attention view owns the row order, the sort controls
        // disable instead of pretending to work.
        <View style={styles.cardPresentation}>
          <RosterCardSortBar sort={sort} onChange={setSort} disabled={needsAttention} />
          <FlatList
            data={sortedMembers}
            keyExtractor={(member) => member.tag}
            renderItem={({ item }) => (
              <RosterCard
                member={item}
                onPress={openMember}
                verdict={needsAttention ? verdictByTag.get(item.tag) : undefined}
              />
            )}
            initialNumToRender={INITIAL_CARDS_TO_RENDER}
            maxToRenderPerBatch={CARDS_PER_BATCH}
            contentContainerStyle={styles.rosterListContent}
            style={styles.rosterList}
          />
        </View>
      ) : (
        <RosterTable
          members={sortedMembers}
          sort={sort}
          onPressColumn={handleColumnPress}
          onPressMember={openMember}
          verdictByTag={needsAttention ? verdictByTag : undefined}
          sortDisabled={needsAttention}
        />
      )}
    </View>
  );
}

// ---------- donation control bar ----------

interface DonationControlBarProps {
  needsAttention: boolean;
  onToggleNeedsAttention: () => void;
  target: DonationTarget;
  onSelectTarget: (target: DonationTarget) => void;
  summary: ReturnType<typeof computeDonationBalance>['summary'];
  styles: ReturnType<typeof createRosterStyles>;
}

function DonationControlBar({
  needsAttention,
  onToggleNeedsAttention,
  target,
  onSelectTarget,
  summary,
  styles,
}: DonationControlBarProps) {
  const healthText =
    summary.healthShare === null
      ? '\u2014'
      : `${Math.round(summary.healthShare * 100)}% at target`;
  return (
    <View style={styles.controlBar}>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel="Needs attention"
        accessibilityHint="Re-orders the roster worst-first by donation deficit and shows the ratio chip on flagged members."
        // aria-checked directly, not accessibilityState: react-native-web
        // 0.20 does not map accessibilityState onto aria attributes, so the
        // switch would never announce its state (the Dropdown's trigger uses
        // aria-expanded directly for the same reason). The switch is what
        // tells a screen reader the sort controls are paused.
        aria-checked={needsAttention}
        onPress={onToggleNeedsAttention}
        style={({ pressed }) => [
          styles.toggle,
          needsAttention && styles.toggleOn,
          pressed && styles.togglePressed,
        ]}
      >
        <Text style={[styles.toggleLabel, needsAttention && styles.toggleLabelOn]}>
          Needs attention
        </Text>
      </Pressable>
      {needsAttention ? (
        <View style={styles.targetRow}>
          {TARGET_OPTIONS.map((option) => {
            const selected = option.value === target;
            return (
              <Pressable
                key={option.label}
                accessibilityRole="button"
                accessibilityLabel={`Target ${option.label}`}
                accessibilityHint="Sets the donation target ratio. The roster re-computes locally, no refetch."
                aria-pressed={selected}
                onPress={() => onSelectTarget(option.value)}
                style={({ pressed }) => [
                  styles.targetChip,
                  selected && styles.targetChipSelected,
                  pressed && styles.targetChipPressed,
                ]}
              >
                <Text style={[styles.targetChipText, selected && styles.targetChipTextSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
          <Text style={styles.healthLabel}>{healthText}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ---------- tab content placeholder ----------

interface TabPlaceholderProps {
  tab: Exclude<ClanTab, 'roster'>;
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

// The roster section's own styles (STD-13): it builds them from the theme
// like any component, never receives the screen's stylesheet as a prop.
function createRosterStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    rosterWrap: {
      flex: 1,
    },
    // The donation control bar sits above the roster. Quiet chrome: a flat
    // row, not a raised panel, so the roster table keeps the visual weight.
    controlBar: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      columnGap: t.spacing[4],
      rowGap: t.spacing[2],
      marginBottom: t.spacing[3],
    },
    // The card presentation's wrapper: flexes like the table's grid wrapper
    // so the FlatList below the sort bar stays the scroll container.
    cardPresentation: {
      flex: 1,
    },
    // The sort bar rides above the scrolling card list. Bottom-aligned so
    // the direction pill lines up with the dropdown's trigger, not its
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
    toggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: t.layout.touchTargetMin,
      paddingHorizontal: t.spacing[5],
      paddingVertical: t.spacing[2],
      borderRadius: t.radius.pill,
      borderWidth: 1,
      borderColor: c.panelBorderStrong,
      backgroundColor: c.panelRaised,
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    toggleOn: {
      backgroundColor: c.accent,
      borderColor: c.accent,
    },
    togglePressed: {
      opacity: 0.7,
    },
    toggleLabel: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.body,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
    },
    toggleLabelOn: {
      color: c.textOnAccent,
    },
    targetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      columnGap: t.spacing[2],
      rowGap: t.spacing[2],
    },
    targetChip: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: t.layout.touchTargetMin,
      paddingHorizontal: t.spacing[4],
      paddingVertical: t.spacing[1],
      borderRadius: t.radius.pill,
      borderWidth: 1,
      borderColor: c.panelBorderStrong,
      backgroundColor: c.panelRaised,
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    targetChipSelected: {
      backgroundColor: c.accentSoft,
      borderColor: c.accent,
    },
    targetChipPressed: {
      opacity: 0.7,
    },
    targetChipText: {
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.medium,
      color: c.textPrimary,
    },
    targetChipTextSelected: {
      color: c.accent,
      fontWeight: t.fontWeight.semibold,
    },
    healthLabel: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textMuted,
      fontVariant: ['tabular-nums'],
    },
    // The card list's scroll container; the table presentation brings its
    // own inside RosterTable.
    rosterList: {
      flex: 1,
    },
    rosterListContent: {
      paddingBottom: t.spacing[6],
    },
  });
}

// The loading skeleton's own styles (STD-13, the RosterSection pattern).
// Each block mirrors the success element it stands in for; the mirror is
// the point (layout-matched, 06 section 3), so a change to the success
// layout is a change here in the same PR.
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
    identity: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: t.spacing[4],
    },
    identityText: {
      flex: 1,
      gap: t.spacing[1],
      flexWrap: 'wrap',
    },

    // Mirrors the requirements chip row.
    requirementsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: t.spacing[2],
      rowGap: t.spacing[2],
    },
    requirementChip: {
      backgroundColor: c.panel,
      borderRadius: t.radius[1],
      borderWidth: 1,
      borderColor: c.panelBorder,
      paddingHorizontal: t.spacing[3],
      paddingVertical: t.spacing[2],
      gap: t.spacing[1],
      minWidth: 96,
    },

    // Mirrors the stat chip row's rhythm (the kit StatChip carries its own
    // internals; the skeleton only needs the same gaps).
    statRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: t.spacing[6],
      rowGap: t.spacing[3],
    },
    statCell: {
      gap: t.spacing[1],
    },
    caption: {
      marginTop: t.spacing[1],
    },

    // Mirrors the real tab bar's container.
    tabBar: {
      flexDirection: 'row',
      gap: t.spacing[1],
      marginTop: t.spacing[5],
      padding: t.spacing[1],
      backgroundColor: c.panel,
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorder,
    },
    tabCell: {
      flex: 1,
      minHeight: t.layout.touchTargetMin,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // The table-shaped roster skeleton: a panel like RosterTable's, with a
    // header row and body rows at the same row height the real rows keep.
    rosterPanel: {
      marginTop: t.spacing[4],
      backgroundColor: c.panel,
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
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: t.spacing[4],
      marginBottom: t.spacing[6],
    },
    headerText: {
      flex: 1,
      gap: t.spacing[2],
    },
    detailPanel: {
      gap: t.spacing[5],
    },

    // success: identity block
    successWrap: {
      gap: t.spacing[5],
    },
    identity: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: t.spacing[4],
    },
    identityText: {
      flex: 1,
      gap: t.spacing[1],
      flexWrap: 'wrap',
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
      marginTop: t.spacing[1],
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
    badge: {
      width: 64,
      height: 64,
      borderRadius: t.radius[3],
      backgroundColor: c.panel,
    },
    badgePlaceholder: {
      width: 64,
      height: 64,
      borderRadius: t.radius[3],
      backgroundColor: c.hairline,
    },
    description: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.body,
      lineHeight: Math.round(t.lineHeight.relaxed * t.fontSize.body),
      color: c.textSecondary,
    },

    // requirements
    requirementsBlock: {
      gap: t.spacing[2],
    },
    requirementsLabel: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    requirementsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: t.spacing[2],
      rowGap: t.spacing[2],
    },
    requirementChip: {
      backgroundColor: c.panel,
      borderRadius: t.radius[1],
      borderWidth: 1,
      borderColor: c.panelBorder,
      paddingHorizontal: t.spacing[3],
      paddingVertical: t.spacing[2],
      gap: t.spacing[1],
      minWidth: 96,
    },
    requirementChipLabel: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    requirementChipValue: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
      fontVariant: ['tabular-nums'],
    },

    // stat row (reuses the kit StatChip; the row just lays them out)
    statRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: t.spacing[6],
      rowGap: t.spacing[3],
    },

    // tab bar
    tabBar: {
      flexDirection: 'row',
      gap: t.spacing[1],
      marginTop: t.spacing[5],
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
      minHeight: t.layout.touchTargetMin,
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

    // tab content: flexes to fill the screen's remaining height so the
    // roster's FlatList can own scrolling (the search screen's resultsArea
    // does the same), with a floor so the roster stays usable on short
    // viewports; below the floor the page grows instead (NFR-05).
    tabContent: {
      flex: 1,
      minHeight: ROSTER_REGION_MIN_HEIGHT,
      marginTop: t.spacing[4],
    },

    // footer
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: t.spacing[3],
      marginTop: t.spacing[6],
      marginBottom: t.spacing[8],
    },
  });
}
