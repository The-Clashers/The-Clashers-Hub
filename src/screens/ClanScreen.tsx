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
import { ThemeToggle } from '../components/ThemeToggle';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import PillButton from '../components/PillButton';
import RosterTable from '../components/RosterTable';
import RosterCard from '../components/RosterCard';
import Dropdown from '../components/Dropdown';
import { fetchClan, ClanFetchError, type ClanMember } from '../api/clan';
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
// the search bar's #tag path both land here. The screen owns layout and the
// route's state; the pieces it renders come from the shared kit (07 section 4):
// ErrorState for the contract's three failure kinds, EmptyState for the
// designed "this tab lands later" placeholder, PillButton for the retry and
// back-to-search actions, ThemeToggle for the header, RosterTable and
// RosterCard for the Roster tab (T-M1-4). Every state the design language
// requires is designed (06 section 3): a layout-matched loading skeleton,
// the contract's three error states (not_found, busy, unreachable) plus
// bad_request, and the success state with the compact horizontal identity
// block and its details band, the tab bar, and the roster.
//
// The tab bar reads `?tab=` from the URL (03 section 2 "Screens & URLs") so a
// deep link to the War or Log tab is shareable (F-12). Roster is the default
// when the param is absent or holds an unknown value. The War and Log tabs
// keep their designed placeholders until M3; the Roster tab renders the real
// roster from the same single clan fetch (SR-09).
//
// The route param carries the bare tag (shareable URLs carry no `#` and no
// `%23`, see src/lib/tag.ts), canonicalized back through the tag module so
// the fetch, the cache key, and the on-screen tag all agree on `#TAG`.

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
      // cannot fix it. Everything else gets the single default retry (the
      // tier already retries upstream throttles itself).
      if (error instanceof ClanFetchError) {
        if (error.result.kind === 'not_found' || error.result.kind === 'bad_request') {
          return false;
        }
      }
      return failureCount < 1;
    },
  });

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

          <View style={[base.panelRaised, styles.detailPanel]}>
            {query.isPending ? (
              <ClanSkeleton base={base} styles={styles} />
            ) : query.isError ? (
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

// ---------- success: compact horizontal identity + details band ----------

interface ClanSuccessProps {
  clan: Awaited<ReturnType<typeof fetchClan>>;
  base: ReturnType<typeof createBaseStyles>;
  styles: ReturnType<typeof createStyles>;
}

function ClanSuccess({ clan, base, styles }: ClanSuccessProps) {
  // The identity block is horizontal and short (the owner's layout call):
  // badge, name, tag/level/location line on the left to right, description
  // clamped to two lines under it. Everything F-04's identity block
  // requires stays, arranged as one compact band instead of stacked blocks.
  // The badge is an API icon (07 section 7) in the 48 px slot, rendered
  // through RN Image so a slow CDN load never reflows the block; a missing
  // badge gets a quiet block instead, never a broken-image glyph.
  const badgeUri = clan.badgeUrls?.medium || clan.badgeUrls?.small;
  const locationName = clan.location?.name ?? 'No location';
  // The details band: the stat chips and the join requirements merged into
  // one left-to-right row of inline label-value chips. Trophies and TH read
  // as the join requirements they are ("Trophies req", "TH req") so the
  // band needs no group headings to stay honest.
  const details: ReadonlyArray<{ label: string; value: string }> = [
    { label: 'Members', value: String(clan.members) },
    { label: 'Win streak', value: String(clan.warWinStreak) },
    { label: 'War wins', value: String(clan.warWins) },
    { label: 'Points', value: String(clan.clanPoints) },
    { label: 'Trophies req', value: String(clan.requirements.requiredTrophies) },
    ...(clan.requirements.requiredTownhallLevel !== undefined
      ? [{ label: 'TH req', value: `TH ${clan.requirements.requiredTownhallLevel}` }]
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
          {clan.description ? (
            <Text style={styles.description} numberOfLines={2}>
              {clan.description}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.detailsRow}>
        {details.map((detail) => (
          <View key={detail.label} style={styles.detailChip}>
            <Text style={styles.detailChipLabel}>{detail.label}</Text>
            <Text style={styles.detailChipValue} numberOfLines={1}>
              {detail.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ---------- loading skeleton ----------

interface ClanSkeletonProps {
  base: ReturnType<typeof createBaseStyles>;
  styles: ReturnType<typeof createStyles>;
}

function ClanSkeleton({ base, styles }: ClanSkeletonProps) {
  // Layout-matched skeleton (06 section 3): same shape as the success state
  // (badge, name, meta line, description, details band) so the swap from
  // skeleton to data does not reflow. No spinner; the layout is the
  // signal that data is on its way.
  return (
    <View style={styles.successWrap} accessibilityRole="progressbar" accessibilityLabel="Loading clan">
      <View style={styles.identity}>
        <View style={[styles.badge, styles.skeletonBlock]} />
        <View style={styles.identityText}>
          <View style={[styles.skeletonLine, styles.skeletonTitle]} />
          <View style={[styles.skeletonLine, styles.skeletonMeta]} />
          <View style={[styles.skeletonLine, styles.skeletonDescription]} />
        </View>
      </View>
      <View style={styles.detailsRow}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={styles.detailChip}>
            <View style={[styles.skeletonLine, styles.skeletonDetailValue]} />
          </View>
        ))}
      </View>
      <Text style={[base.caption, styles.skeletonCaption]}>Fetching through the tier…</Text>
    </View>
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
  // cannot fix a retired tag.
  if (error instanceof ClanFetchError) {
    const result = error.result;
    if (result.kind === 'not_found') {
      return (
        <ErrorState
          tone="gone"
          title="No clan with this tag"
          body={`The tag ${tag} did not resolve. The clan was retired, or the URL is stale. Search the clan by name instead.`}
          action={<PillButton label="Search clans" role="link" arrow onPress={onSearch} />}
        />
      );
    }
    if (result.kind === 'busy') {
      return (
        <ErrorState
          tone="busy"
          title="The game API is busy"
          body={`Upstream answered 429. The tier already retried with backoff; trying again in about ${result.retryAfter}s, or hit retry to nudge it.`}
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
  /** While the needs-attention view owns the row order, the column sort is
   * not in effect, so both controls disable rather than lie about it. */
  disabled: boolean;
}

function RosterCardSortBar({ sort, onChange, disabled }: RosterCardSortBarProps) {
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

// Preset target ratios are gone: the donation ratio is a free two-number
// input now (see DonationRatioInput), so this space holds no chip list.

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
    <>
      <DonationControlBar
        needsAttention={needsAttention}
        onToggleNeedsAttention={() => setNeedsAttention((previous) => !previous)}
        onSelectTarget={setTarget}
        summary={balance.summary}
      />
      {isCardPresentation ? (
        // The card presentation has no column headers, so the sort rides in
        // the bar above the list. The cards render in page flow like the
        // table rows: the browser scrollbar owns the scrolling (07 section
        // 3), so the roster runs as long as it runs instead of boxing the
        // visitor into a four-card inner scroll window. While the
        // needs-attention view owns the row order, the sort controls
        // disable instead of pretending to work.
        <>
          <RosterCardSortBar sort={sort} onChange={setSort} disabled={needsAttention} />
          {sortedMembers.map((member) => (
            <RosterCard
              key={member.tag}
              member={member}
              onPress={openMember}
              verdict={needsAttention ? verdictByTag.get(member.tag) : undefined}
            />
          ))}
        </>
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
    </>
  );
}

// ---------- donation control bar ----------

interface DonationControlBarProps {
  needsAttention: boolean;
  onToggleNeedsAttention: () => void;
  onSelectTarget: (target: DonationTarget) => void;
  summary: ReturnType<typeof computeDonationBalance>['summary'];
}

// The bar builds its own styles (STD-13, paid down from the threading the
// session 22 log flagged): a component's stylesheet is its own, never a
// prop on the caller's roster sheet.
function DonationControlBar({
  needsAttention,
  onToggleNeedsAttention,
  onSelectTarget,
  summary,
}: DonationControlBarProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createDonationBarStyles(theme), [theme]);
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
      <DonationRatioInput
        onSelectTarget={onSelectTarget}
        // The boxes stay mounted and disable while the needs-attention view
        // is off (the disable-not-hide rule the sort controls already
        // follow): mounted, their draft values never reset on a toggle, so
        // what the boxes show is always the ratio the engine runs with.
        disabled={!needsAttention}
        styles={styles}
      />
      {needsAttention ? <Text style={styles.healthLabel}>{healthText}</Text> : null}
    </View>
  );
}

// ---------- donation ratio input ----------

interface DonationRatioInputProps {
  onSelectTarget: (target: DonationTarget) => void;
  /** While the needs-attention view is off the ratio has no visible effect,
   * so the boxes dim and stop taking input instead of pretending to work. */
  disabled: boolean;
  styles: ReturnType<typeof createDonationBarStyles>;
}

// The donation ratio input: two number boxes, "__ : __", the target ratio
// written as given : received (SR-12's adjustable target). This replaces the
// preset chip row (0.5 / 1:1 / 1.5 / 2.0) on the owner's call: a free
// two-number ratio says exactly what the visitor means ("1 : 2" is give
// half, "3 : 2" is give 1.5x) without reading a legend of decimals. The
// drafts start at "1"/"1", mirroring DEFAULT_DONATION_TARGET's 1:1; the
// parsed pair is the only writer of the target, so the boxes never drift
// from what the engine runs with.
function DonationRatioInput({ onSelectTarget, disabled, styles }: DonationRatioInputProps) {
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
          editable={!disabled}
          style={[styles.ratioInput, disabled && styles.ratioInputDisabled]}
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
          editable={!disabled}
          style={[styles.ratioInput, disabled && styles.ratioInputDisabled]}
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

// The donation control bar's own styles (STD-13, paid down from the
// stylesheet threading session 22 flagged). Quiet chrome: a flat row, not
// a raised panel, so the roster keeps the visual weight.
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
    // Dimmed, not hidden, while the needs-attention view is off: the same
    // disabled treatment the Dropdown's trigger gets.
    ratioInputDisabled: {
      opacity: 0.5,
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

    // success: compact horizontal identity block. The band keeps every
    // F-04 datum but reads left to right at a short height instead of
    // stacking (the owner's layout call): badge and text side by side,
    // details as one inline chip row under it.
    successWrap: {
      gap: t.spacing[4],
    },
    identity: {
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

    // details band: stats and join requirements as one left-to-right row
    // of inline label-value chips, short height
    detailsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: t.spacing[2],
      rowGap: t.spacing[2],
    },
    detailChip: {
      flexDirection: 'row',
      alignItems: 'baseline',
      columnGap: t.spacing[2],
      backgroundColor: c.panel,
      borderRadius: t.radius[1],
      borderWidth: 1,
      borderColor: c.panelBorder,
      paddingHorizontal: t.spacing[3],
      paddingVertical: t.spacing[2],
    },
    detailChipLabel: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    detailChipValue: {
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

    // skeleton placeholders (06 section 3): quiet blocks and lines that
    // mirror the compact success layout so the swap does not reflow.
    skeletonBlock: {
      backgroundColor: c.hairline,
    },
    skeletonLine: {
      backgroundColor: c.hairline,
      borderRadius: t.radius[1],
    },
    skeletonTitle: {
      height: t.fontSize.xl,
      width: 220,
    },
    skeletonMeta: {
      height: t.fontSize.xs,
      width: 180,
      marginTop: t.spacing[2],
    },
    skeletonDescription: {
      height: Math.round(t.lineHeight.normal * t.fontSize.sm),
      width: '100%',
      maxWidth: 420,
      marginTop: t.spacing[2],
    },
    skeletonDetailValue: {
      height: t.fontSize.sm,
      width: 72,
    },
    skeletonCaption: {
      marginTop: t.spacing[1],
    },
  });
}
