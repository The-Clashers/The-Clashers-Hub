import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useNavigate, useSearchParams } from 'react-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTheme, createBaseStyles, breakpointFor } from '../theme';
import Dropdown, { type DropdownOption } from '../components/Dropdown';
import ClanCard from '../components/ClanCard';
import SkeletonCard from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import PillButton from '../components/PillButton';
import RefreshControl from '../components/RefreshControl';
import { clanRouteFor, normalizeTagInput, TAG_REJECT_COPY } from '../lib/tag';
import { WAR_FREQUENCY_LABELS } from '../lib/war-frequency';
import { busyRetryDelayMs, shouldRetryBusy } from '../lib/busy-retry';
import {
  applyClientFilters,
  fetchSearchPage,
  hasClientFilters,
  SEARCH_NAME_MIN_CHARS,
  SEARCH_NAME_MIN_COPY,
  SearchFetchError,
  type ClanType,
  type SearchFilters,
  type SearchPage,
  type WarFrequency,
} from '../api/search';
import { LOCATION_FILTERS } from '../api/locations';
import { CLAN_LABEL_FILTERS } from '../api/labels';
import { CHAT_LANGUAGE_FILTERS } from '../api/chat-languages';
import { RANKED_LEAGUE_TIERS, leagueTierName } from '../api/league-tiers';
import { HOME_CAP_MAX_TOWN_HALL } from '../lib/town-hall-caps';

// The clans search screen (T-M1-1, FR-01, SR-08), the /clans page since
// the nav revision split the old entry route into real pages. A visitor
// types a clan name OR pastes a clan tag (the # prefix is what tells the
// two apart, since names and bare tags share the same alphabet),
// optionally narrows a name search with the filter row, submits, and gets
// a card list that pages through the upstream cursor as it scrolls. A tag
// skips the listing entirely and opens the clan detail screen directly,
// the same destination the result cards link to. The nav lookup box hands
// name searches to this page through ?name=, which the screen consumes
// once and then strips so a reload starts idle.
//
// The player tag lookup moved to /players (and the nav box); the brand
// and the theme toggle moved to the NavBar; the M0 review-surface links
// retired from this screen's footer on the owner's call, the tokens
// review now living on the contributors page where design QA actually
// happens, and the /hello smoke screen is retired outright since
// /clan/:tag renders everything it showed.
//
// The search panel carries the same shape the player tag box carries
// (the owner's consistency note): a micro label above the input, the
// input and its action button, then one helper line under the row that
// teaches the # rule, so the two lookup panels read as one family.
//
// The filters live behind one "Filters" disclosure with an applied count
// (the owner's rework of the old two-tier row): a name search is the golden
// path, so the panel above the fold is the name box and nothing else; the
// disclosure opens one grid of the narrowing controls — the dropdowns (clan
// size, war frequency, location, clan label, clan type, chat language,
// league required) and the two number boxes (minimum clan level, Town Hall
// required capped at the reference max). The applied state stays glanceable
// with the row collapsed: a removable chip sits over the results for every
// applied filter, disclosure open or not, and pressing a chip's x re-runs
// the search without it.
//
// The filters split by where they run, and the screen keeps the two
// honest:
// - Server-side filters (size, level, war frequency, location, label)
//   ride the tier request; upstream narrows the whole listing, so counts
//   and pagination stay exact.
// - Client-side filters (clan type, chat language, and the two join
//   requirements) have no upstream param, so they narrow the loaded pages
//   only: the meta line reads "N shown of M loaded" while they are in
//   force, and an emptied view keeps paginating (the sentinel and a Load
//   more action) instead of reading as "no results".
//
// The join requirements speak the rank rework: the game replaced the old
// trophy threshold with a league requirement, so the requirement filter is
// a ranked-ladder dropdown ("clans whose required league is at most mine")
// fed by the bundled ladder table, and the Town Hall requirement is a
// number box capped at the highest hall the reference data covers. The
// number boxes clamp as they type, so the draft can never hold a value the
// tier would reject or the game cannot mean.
//
// The screen owns layout, composition, and the route's state; the pieces
// it renders come from the shared kit (07 section 4): ClanCard,
// SkeletonCard, EmptyState, ErrorState, PillButton, Dropdown. Every state
// the design language requires is designed: loading skeleton, error
// branches with a next action, empty results with a relax-filters
// suggestion, and the success list.
//
// Three behaviors are deliberate and load-bearing:
//
// - Filters apply on submit, not while they are picked. Every distinct
//   server-side filter combination is a distinct cache key on the tier,
//   so live re-searching on every change would burn upstream calls the
//   TTL cache cannot absorb. A "changed since the last search" hint
//   keeps that honest. Removing an applied chip is the one exception,
//   and it is not really an exception: the chip is the applied state,
//   so pressing its x is a submit.
// - The results render in page flow (the owner's call, the same scroll
//   model the roster tab uses): the browser scrollbar owns the
//   scrolling, the page grows as pages append, and a sentinel under the
//   last card loads the next page when it nears the viewport. The page
//   still lands 30 clans at a time (the tier's page limit), so a first
//   screenful costs one upstream call and the rest load a few more at
//   the bottom.
// - The game API rejects clan names shorter than three characters (a
//   400 badName upstream; the tier mirrors the floor so the same
//   rejection costs ~1 ms there). The submit path teaches the rule
//   inline before any request is made — the same hint rhythm the #
//   tag rule uses — and the clear-on-fix logic keeps the hint up until
//   the name actually reaches three characters.

// ---------- filter option tables ----------

/** What the "Clan size" control picks: one bracket, not one number, so
 * minimum and maximum members stay one control in the UI while the tier
 * still receives the two upstream params separately. */
type ClanSizeKey = 'lte10' | 'mid10to30' | 'mid30to49' | 'full';

const CLAN_SIZE_OPTIONS: ReadonlyArray<DropdownOption<ClanSizeKey | undefined>> = [
  { label: 'Any', value: undefined },
  { label: 'Up to 10', value: 'lte10' },
  { label: '10–30', value: 'mid10to30' },
  { label: '30–49', value: 'mid30to49' },
  { label: 'Full (50)', value: 'full' },
];

/** The bracket a size selection maps to. Every branch spells both bounds
 * (undefined included) so spreading the result over the draft clears the
 * pair, never leaves a stale half behind. */
function sizeToBounds(
  key: ClanSizeKey | undefined,
): Pick<SearchFilters, 'minMembers' | 'maxMembers'> {
  switch (key) {
    case 'lte10':
      return { minMembers: undefined, maxMembers: 10 };
    case 'mid10to30':
      return { minMembers: 10, maxMembers: 30 };
    case 'mid30to49':
      return { minMembers: 30, maxMembers: 49 };
    case 'full':
      return { minMembers: 50, maxMembers: undefined };
    default:
      return { minMembers: undefined, maxMembers: undefined };
  }
}

/** The bracket a min/max pair renders as (compound ranges first, so a
 * half-set pair never reads as a narrower bracket than it is). */
function boundsToSize(filters: { minMembers?: number; maxMembers?: number }): ClanSizeKey | undefined {
  if (filters.minMembers === 10 && filters.maxMembers === 30) return 'mid10to30';
  if (filters.minMembers === 30 && filters.maxMembers === 49) return 'mid30to49';
  if (filters.minMembers === 50) return 'full';
  if (filters.minMembers === undefined && filters.maxMembers === 10) return 'lte10';
  return undefined;
}

// The dropdown offers the same labels the result card's War stat renders,
// from the one shared table in lib/war-frequency.ts.
const FREQUENCY_OPTIONS: ReadonlyArray<DropdownOption<WarFrequency | undefined>> = [
  { label: 'Any', value: undefined },
  ...(Object.keys(WAR_FREQUENCY_LABELS) as WarFrequency[]).map((value) => ({
    label: WAR_FREQUENCY_LABELS[value],
    value,
  })),
];

const LOCATION_OPTIONS: ReadonlyArray<DropdownOption<number | undefined>> = [
  { label: 'Any', value: undefined },
  ...LOCATION_FILTERS.map((location) => ({ label: location.name, value: location.id })),
];

const LABEL_OPTIONS: ReadonlyArray<DropdownOption<number | undefined>> = [
  { label: 'Any', value: undefined },
  ...CLAN_LABEL_FILTERS.map((label) => ({ label: label.name, value: label.id })),
];

// The membership states the game API reports; a closed clan is still worth
// finding (you can request to join), so all three are offered.
const TYPE_OPTIONS: ReadonlyArray<DropdownOption<ClanType | undefined>> = [
  { label: 'Any', value: undefined },
  { label: 'Open', value: 'open' },
  { label: 'Invite only', value: 'inviteOnly' },
  { label: 'Closed', value: 'closed' },
];

const LANGUAGE_OPTIONS: ReadonlyArray<DropdownOption<string | undefined>> = [
  { label: 'Any', value: undefined },
  ...CHAT_LANGUAGE_FILTERS.map((language) => ({ label: language.name, value: language.code })),
];

// The league requirement reads as a cap on the ranked ladder ("clans I can
// actually join" asks for clans whose required league is at most mine), the
// same semantics the old trophy cap carried. "None" (0) is its own option
// because gate-less clans are a thing people search for directly, and
// applyClientFilters treats an absent gate as passing every cap, so 0
// selects exactly those. The ladder itself is the bundled table in
// src/api/league-tiers.ts.
const LEAGUE_OPTIONS: ReadonlyArray<DropdownOption<number | undefined>> = [
  { label: 'Any', value: undefined },
  { label: 'None', value: 0 },
  ...RANKED_LEAGUE_TIERS.filter((tier) => tier.tier > 0).map((tier) => ({
    label: tier.name,
    value: tier.tier,
  })),
];

// The two number boxes' honest bounds: the tier accepts a clan level of
// 1 through 30, and the Town Hall requirement cannot exceed the highest
// hall the reference data covers (lib/town-hall-caps.ts, the same module
// the progression grid reads).
const CLAN_LEVEL_MIN = 1;
const CLAN_LEVEL_MAX = 30;

const CLAN_TYPE_LABELS: Record<ClanType, string> = {
  open: 'Open',
  inviteOnly: 'Invite only',
  closed: 'Closed',
};

/** The draft every filter control edits: the submitted filters minus the
 * name (the name input owns its own draft). One object, because eleven
 * independent useStates would drown the screen in setters and the clear
 * and dirty logic in field lists. */
type SearchFilterDraft = Omit<SearchFilters, 'name'>;

function filtersEqual(a: SearchFilters, b: SearchFilters): boolean {
  return (
    a.name === b.name &&
    a.minMembers === b.minMembers &&
    a.maxMembers === b.maxMembers &&
    a.minClanLevel === b.minClanLevel &&
    a.warFrequency === b.warFrequency &&
    a.locationId === b.locationId &&
    a.labelId === b.labelId &&
    a.clanType === b.clanType &&
    a.chatLanguage === b.chatLanguage &&
    a.maxRequiredLeagueTier === b.maxRequiredLeagueTier &&
    a.maxRequiredTownhall === b.maxRequiredTownhall
  );
}

function nameForId(options: ReadonlyArray<{ id: number; name: string }>, id: number): string | undefined {
  return options.find((option) => option.id === id)?.name;
}

function nameForLanguage(code: string): string | undefined {
  return CHAT_LANGUAGE_FILTERS.find((language) => language.code === code)?.name;
}

// The client staleTime mirrors the tier's 60 s search TTL (SR-08) so the two
// cache layers decay together, the same pairing the hello screen uses.
const SEARCH_STALE_TIME_MS = 60_000;

// The filter cells wrap on their own, and the cell basis follows the
// shared breakpoint helper the design language mandates (07 section 3,
// JS-driven layout): two per row on a small phone (the 360 px
// compatibility floor leaves ~247 px of row, so the basis has to sit under
// half of that), and roomier cells from the mobile tier up so labels like
// TOWN HALL REQUIRED never wrap. Cells grow to share whatever row they
// land in. Micro labels that cannot fit a half-width cell wrap to a second
// line rather than truncating: a wrapped label reads, a cut one guesses.
const FILTER_CELL_BASIS_SMALL = 116;
const FILTER_CELL_BASIS_WIDE = 150;

// Six skeleton cards fill the fold without implying anything about how many
// results are coming.
const SKELETON_CARD_COUNT = 6;

// Two skeleton cards while the next page loads: enough to say "more of the
// same is coming" without implying a page size.
const SKELETON_FOOTER_CARD_COUNT = 2;

// How far below the viewport the load-more sentinel starts pulling the
// next page, the scroll-ahead the old list's onEndReachedThreshold bought.
const SENTINEL_LOOKAHEAD = '400px 0px';

// ---------- the screen ----------

export default function SearchScreen() {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // The filter cell basis follows the shared breakpoint tiers: half-width
  // cells on a small phone, roomier cells from mobile up (the JS-driven
  // layout rule, same helper the roster's presentation switch uses).
  const { width } = useWindowDimensions();
  const filterCellBasis =
    breakpointFor(width) === 'small' ? FILTER_CELL_BASIS_SMALL : FILTER_CELL_BASIS_WIDE;
  const styles = useMemo(() => createStyles(theme, filterCellBasis), [theme, filterCellBasis]);

  const [nameDraft, setNameDraft] = useState('');
  const [filterDraft, setFilterDraft] = useState<SearchFilterDraft>({});
  // The one hint line under the search bar: the empty prompt on a blank
  // submit, the tag rule's sentence when a # input is not a valid tag, or
  // the three-character rule when a name is too short. Null when there is
  // nothing to complain about.
  const [searchHint, setSearchHint] = useState<string | null>(null);
  // null until the first submit: the screen starts in the idle state, not in
  // loading. The query is disabled while this is null.
  const [submitted, setSubmitted] = useState<SearchFilters | null>(null);
  // The filter grid stays collapsed until asked for; the applied count on
  // the toggle and the chip row over the results keep the applied state
  // visible either way.
  const [showFilters, setShowFilters] = useState(false);

  // The nav lookup's name handoff: /clans?name=<text> seeds the input and
  // runs the search once on arrival, then the param is stripped so a
  // reload or a back-navigation starts idle instead of replaying it. The
  // ref guards the StrictMode double-effect, and a same-route navigation
  // (searching again from the nav box while already here) re-seeds because
  // the param value changes.
  const seededName = useRef<string | null>(null);
  useEffect(() => {
    const nameParam = searchParams.get('name');
    if (nameParam === null || nameParam.trim() === '' || seededName.current === nameParam) {
      return;
    }
    seededName.current = nameParam;
    const name = nameParam.trim();
    setNameDraft(name);
    setSearchHint(null);
    setSubmitted({ name, ...filterDraft });
    setSearchParams({}, { replace: true });
    // The filter values are read once, at seed time, which runs on arrival
    // while the filters still hold their defaults; a later filter change
    // re-submits through the Search button like any other search.
  }, [searchParams]);

  const setFilters = (patch: Partial<SearchFilterDraft>) => {
    setFilterDraft((draft) => ({ ...draft, ...patch }));
  };

  const draftFilters = useMemo<SearchFilters>(
    () => ({ name: nameDraft.trim(), ...filterDraft }),
    [nameDraft, filterDraft],
  );
  const dirty = submitted !== null && !filtersEqual(submitted, draftFilters);

  const submit = () => {
    const raw = nameDraft.trim();
    if (raw.length < 1) {
      setSearchHint('Type a clan name or tag first.');
      return;
    }
    // A leading # is the one honest way to say "this is a tag, not a name":
    // bare tags and names share the [A-Z0-9] alphabet, so anything without
    // the # is a name search. The tag goes through the same rule and route
    // builder as every other tag in the app (lib/tag.ts, SR-13) and opens
    // the clan detail screen directly, skipping the listing.
    if (raw.startsWith('#')) {
      const tag = normalizeTagInput(raw);
      if (tag.ok) {
        setSearchHint(null);
        navigate(clanRouteFor(tag.tag));
      } else {
        setSearchHint(tag.reason === 'empty' ? 'Type a clan name or tag first.' : TAG_REJECT_COPY[tag.reason]);
      }
      return;
    }
    // The game API rejects shorter names outright (400 badName), so the
    // rule is taught here, before any request is made.
    if (raw.length < SEARCH_NAME_MIN_CHARS) {
      setSearchHint(SEARCH_NAME_MIN_COPY);
      return;
    }
    setSearchHint(null);
    setSubmitted({ name: raw, ...filterDraft });
  };

  const clearFilters = () => {
    setFilterDraft({});
    setSubmitted((previous) => (previous === null ? previous : { name: previous.name }));
  };

  // Removing one applied chip re-submits immediately: the chip is the
  // applied state (pressing its x is a submit), and the draft moves with
  // it so the panel never disagrees with what the results show.
  const removeChip = (patch: Partial<SearchFilterDraft>) => {
    setFilterDraft((draft) => ({ ...draft, ...patch }));
    setSubmitted((previous) => (previous === null ? previous : { ...previous, ...patch }));
  };

  // Clears only the four client-side filters (the ones that empty the view
  // without touching the request); server-side filters and the name stay.
  const clearClientFilters = () => {
    removeChip({
      clanType: undefined,
      chatLanguage: undefined,
      maxRequiredLeagueTier: undefined,
      maxRequiredTownhall: undefined,
    });
  };

  const query = useInfiniteQuery({
    queryKey: ['search', submitted] as const,
    queryFn: ({ pageParam }) => fetchSearchPage(submitted as SearchFilters, pageParam),
    enabled: submitted !== null,
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: SearchPage) => lastPage.after,
    staleTime: SEARCH_STALE_TIME_MS,
    retry: (failureCount, error) => {
      // A 400 is our request being wrong; retrying the same request cannot
      // fix it, so we stop. The busy outcome auto-retries with backoff (06
      // section 3): the tier already retried the throttle itself, so the
      // client paces itself through lib/busy-retry and the screen keeps its
      // skeleton with a "one moment" note instead of flipping to an error
      // screen. Everything else gets the single default retry.
      if (error instanceof SearchFetchError) {
        if (error.result.kind === 'bad_request') {
          return false;
        }
        if (error.result.kind === 'busy') {
          return shouldRetryBusy(failureCount);
        }
      }
      return failureCount < 1;
    },
    retryDelay: (failureCount, error) => {
      if (error instanceof SearchFetchError && error.result.kind === 'busy') {
        return busyRetryDelayMs(error.result.retryAfter, failureCount);
      }
      // Only the single default retry ever waits on this: the library's
      // own first backoff.
      return 1_000;
    },
  });

  // Everything loaded so far, and what the client-side filters leave of it.
  // The distinction is the honesty contract: counts over loadedItems are
  // exact for server-side filters, and the meta line switches to "N shown
  // of M loaded" whenever the narrowing happens here.
  const loadedItems = useMemo(
    () => (query.data ? query.data.pages.flatMap((page) => page.items) : []),
    [query.data],
  );
  const shownItems = useMemo(
    () => (submitted !== null ? applyClientFilters(loadedItems, submitted) : loadedItems),
    [loadedItems, submitted],
  );
  const clientFiltering = submitted !== null && hasClientFilters(submitted);
  const firstPageAge = query.data?.pages[0]?.age ?? 0;

  // True while the first load is auto-retrying a busy answer: the skeleton
  // stays up and its note says "one moment" (06 section 3), so a throttled
  // upstream reads as a slow fetch, not an error screen.
  const busyRetrying =
    query.isPending &&
    query.failureReason instanceof SearchFetchError &&
    query.failureReason.result.kind === 'busy';

  const hasActiveFilters =
    submitted !== null &&
    (submitted.minMembers !== undefined ||
      submitted.maxMembers !== undefined ||
      submitted.minClanLevel !== undefined ||
      submitted.warFrequency !== undefined ||
      submitted.locationId !== undefined ||
      submitted.labelId !== undefined ||
      submitted.clanType !== undefined ||
      submitted.chatLanguage !== undefined ||
      submitted.maxRequiredLeagueTier !== undefined ||
      submitted.maxRequiredTownhall !== undefined);

  // ---------- the applied-filter chips ----------

  // One chip per applied filter, in the results area (they describe the
  // search that produced the list, and they stay visible with the second
  // tier collapsed). Each carries the patch that clears it.
  const appliedChips: Array<{ key: string; label: string; remove: () => void }> = [];
  if (submitted !== null) {
    const sizeKey = boundsToSize(submitted);
    if (sizeKey !== undefined) {
      appliedChips.push({
        key: 'size',
        label: CLAN_SIZE_OPTIONS.find((option) => option.value === sizeKey)?.label ?? 'Clan size',
        remove: () => removeChip({ minMembers: undefined, maxMembers: undefined }),
      });
    }
    if (submitted.minClanLevel !== undefined) {
      appliedChips.push({
        key: 'level',
        label: `Level ${submitted.minClanLevel}+`,
        remove: () => removeChip({ minClanLevel: undefined }),
      });
    }
    if (submitted.warFrequency !== undefined) {
      appliedChips.push({
        key: 'frequency',
        label: WAR_FREQUENCY_LABELS[submitted.warFrequency],
        remove: () => removeChip({ warFrequency: undefined }),
      });
    }
    if (submitted.locationId !== undefined) {
      appliedChips.push({
        key: 'location',
        label: nameForId(LOCATION_FILTERS, submitted.locationId) ?? 'Location',
        remove: () => removeChip({ locationId: undefined }),
      });
    }
    if (submitted.labelId !== undefined) {
      appliedChips.push({
        key: 'label',
        label: nameForId(CLAN_LABEL_FILTERS, submitted.labelId) ?? 'Clan label',
        remove: () => removeChip({ labelId: undefined }),
      });
    }
    if (submitted.clanType !== undefined) {
      appliedChips.push({
        key: 'type',
        label: CLAN_TYPE_LABELS[submitted.clanType],
        remove: () => removeChip({ clanType: undefined }),
      });
    }
    if (submitted.chatLanguage !== undefined) {
      appliedChips.push({
        key: 'language',
        label: nameForLanguage(submitted.chatLanguage) ?? submitted.chatLanguage,
        remove: () => removeChip({ chatLanguage: undefined }),
      });
    }
    if (submitted.maxRequiredLeagueTier !== undefined) {
      appliedChips.push({
        key: 'league',
        label:
          submitted.maxRequiredLeagueTier === 0
            ? 'No league requirement'
            : `Up to ${
                leagueTierName(submitted.maxRequiredLeagueTier) ??
                `league tier ${submitted.maxRequiredLeagueTier}`
              }`,
        remove: () => removeChip({ maxRequiredLeagueTier: undefined }),
      });
    }
    if (submitted.maxRequiredTownhall !== undefined) {
      appliedChips.push({
        key: 'townhall',
        label:
          submitted.maxRequiredTownhall === 0
            ? 'No Town Hall requirement'
            : `Town Hall ${submitted.maxRequiredTownhall} max`,
        remove: () => removeChip({ maxRequiredTownhall: undefined }),
      });
    }
  }

  // ---------- the load-more sentinel ----------

  // The sentinel's DOM id. DOM access goes through nativeID +
  // getElementById, the house pattern (refs on View fight the RN 0.88
  // types; see Dropdown's note). The sentinel renders only in the success
  // branches, under the last card; the observer is recreated whenever the
  // pagination state moves, and IntersectionObserver fires on creation, so
  // a bottom that stays in view keeps loading the next page until it
  // leaves it, the same continuous contract the list's onEndReached kept.
  // The dependency is the LOADED count, not the shown count: while client
  // filters empty the view the sentinel must keep observing so pages keep
  // arriving for the filters to match against.
  const sentinelId = useId();
  const {
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = query;
  useEffect(() => {
    const node = document.getElementById(sentinelId);
    if (node === null) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) {
          void fetchNextPage();
        }
      },
      { rootMargin: SENTINEL_LOOKAHEAD },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [
    sentinelId,
    loadedItems.length,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  ]);

  return (
    <View style={base.appRoot}>
      <View style={base.screen}>
        <View style={[base.contentColumn, styles.column]}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={base.display}>Clans</Text>
              <Text style={base.subtitle}>
                Search by clan name or #tag. Filters narrow name searches.
              </Text>
            </View>
          </View>

          <View style={[base.panelRaised, styles.searchPanel]}>
            <View style={styles.nameWrap}>
              <Text style={styles.nameLabel}>Clan name or tag</Text>
              <View style={styles.nameRow}>
                <TextInput
                  value={nameDraft}
                  onChangeText={(text) => {
                    setNameDraft(text);
                    // Clear the hint as soon as the problem is fixed: a name
                    // once it reaches the three-character floor, a # input
                    // once it normalizes to a valid tag. Mirrors the tag
                    // box's clear-on-fix so both inputs behave the same.
                    if (searchHint === null) return;
                    const trimmed = text.trim();
                    const fixed = trimmed.startsWith('#')
                      ? normalizeTagInput(trimmed).ok
                      : trimmed.length >= SEARCH_NAME_MIN_CHARS;
                    if (fixed) setSearchHint(null);
                  }}
                  onSubmitEditing={submit}
                  placeholder="Clan name or #tag"
                  placeholderTextColor={theme.colors.textMuted}
                  accessibilityLabel="Clan name or tag"
                  accessibilityHint="Type a clan name, or a clan tag starting with #, and press Search."
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={64}
                  style={styles.nameInput}
                />
                <PillButton
                  label="Search"
                  onPress={submit}
                  hint="Runs the search with the current name and filters, or opens the clan directly when the input is a #tag."
                  stretch
                />
              </View>
              {searchHint !== null ? (
                <Text style={styles.validationHint} accessibilityRole="alert">
                  {searchHint}
                </Text>
              ) : null}
              {/* The helper line the player tag box also carries (the
                  owner's consistency note): same muted style, same slot
                  under the input row, teaching this input's rule. */}
              <Text style={styles.nameFootnote}>
                A leading # opens that clan directly. Everything else searches clan names.
              </Text>
            </View>

            {/* The filter disclosure: one toggle row replaces the old
                two-tier layout (primary grid always visible + a More
                filters expander), so the panel above the fold is the name
                box and nothing else. The applied count keeps the collapsed
                row honest, and the chip row over the results carries the
                removable detail. */}
            <View style={styles.filterToolbar}>
              <PillButton
                label={showFilters ? 'Hide filters' : 'Filters'}
                variant="secondary"
                onPress={() => setShowFilters((open) => !open)}
                hint="Reveals the filters that narrow a name search: clan size, clan level, war frequency, location, clan label, clan type, chat language, and the two join requirements."
              />
              {appliedChips.length > 0 ? (
                <Text style={base.caption}>
                  {appliedChips.length === 1 ? '1 applied' : `${appliedChips.length} applied`}
                </Text>
              ) : null}
            </View>
            {showFilters ? (
              <View style={styles.filterGrid}>
                <View style={styles.filterCell}>
                  <Dropdown
                    label="Clan size"
                    options={CLAN_SIZE_OPTIONS}
                    value={boundsToSize(filterDraft)}
                    onSelect={(key) => setFilters(sizeToBounds(key))}
                  />
                </View>
                <View style={styles.filterCell}>
                  <FilterNumberCell
                    label="Min clan level"
                    value={filterDraft.minClanLevel}
                    onValue={(minClanLevel) => setFilters({ minClanLevel })}
                    min={CLAN_LEVEL_MIN}
                    max={CLAN_LEVEL_MAX}
                    placeholder={`Any (${CLAN_LEVEL_MIN}-${CLAN_LEVEL_MAX})`}
                    hint="Keeps clans at or above this level. Leave empty for any."
                  />
                </View>
                <View style={styles.filterCell}>
                  <Dropdown
                    label="War frequency"
                    options={FREQUENCY_OPTIONS}
                    value={filterDraft.warFrequency}
                    onSelect={(warFrequency) => setFilters({ warFrequency })}
                  />
                </View>
                <View style={styles.filterCell}>
                  <Dropdown
                    label="Location"
                    options={LOCATION_OPTIONS}
                    value={filterDraft.locationId}
                    onSelect={(locationId) => setFilters({ locationId })}
                  />
                </View>
                <View style={styles.filterCell}>
                  <Dropdown
                    label="Clan label"
                    options={LABEL_OPTIONS}
                    value={filterDraft.labelId}
                    onSelect={(labelId) => setFilters({ labelId })}
                  />
                </View>
                <View style={styles.filterCell}>
                  <Dropdown
                    label="Clan type"
                    options={TYPE_OPTIONS}
                    value={filterDraft.clanType}
                    onSelect={(clanType) => setFilters({ clanType })}
                  />
                </View>
                <View style={styles.filterCell}>
                  <Dropdown
                    label="Chat language"
                    options={LANGUAGE_OPTIONS}
                    value={filterDraft.chatLanguage}
                    onSelect={(chatLanguage) => setFilters({ chatLanguage })}
                  />
                </View>
                <View style={styles.filterCell}>
                  <Dropdown
                    label="League required"
                    options={LEAGUE_OPTIONS}
                    value={filterDraft.maxRequiredLeagueTier}
                    onSelect={(maxRequiredLeagueTier) => setFilters({ maxRequiredLeagueTier })}
                  />
                </View>
                <View style={styles.filterCell}>
                  <FilterNumberCell
                    label="Town Hall required"
                    value={filterDraft.maxRequiredTownhall}
                    onValue={(maxRequiredTownhall) => setFilters({ maxRequiredTownhall })}
                    min={0}
                    max={HOME_CAP_MAX_TOWN_HALL}
                    placeholder={`Any (0-${HOME_CAP_MAX_TOWN_HALL})`}
                    hint={`Keeps clans whose Town Hall requirement is at most this level, 0 through ${HOME_CAP_MAX_TOWN_HALL}. Zero selects clans that ask for nothing.`}
                  />
                </View>
              </View>
            ) : null}
            {dirty ? (
              <Text style={styles.dirtyHint}>
                Changed since the last search. Press Search to apply.
              </Text>
            ) : null}
          </View>

          <View style={styles.resultsArea}>
            {submitted === null ? (
              <EmptyState
                title="Find a clan"
                body="Type a clan name, or a clan tag starting with #, and press Search. Filters are optional and narrow name searches."
              />
            ) : query.isPending ? (
              <View
                style={styles.skeletonWrap}
                accessibilityRole="progressbar"
                accessibilityLabel="Loading search results"
              >
                {Array.from({ length: SKELETON_CARD_COUNT }, (_, index) => (
                  <SkeletonCard key={index} />
                ))}
                {busyRetrying ? (
                  <Text style={styles.skeletonNote}>
                    The game API is busy. One moment, retrying automatically…
                  </Text>
                ) : null}
              </View>
            ) : query.isError && !query.data ? (
              // The panel replaces the list only when nothing was loaded:
              // once pages exist, a later failure belongs to the footer
              // under the list, never to a whole-screen swap that throws
              // the visitor's scroll away (STD-35, the matrix is per data
              // view).
              <SearchError
                error={query.error as SearchFetchError | Error}
                onRetry={() => void query.refetch()}
                isRetrying={query.isFetching}
              />
            ) : shownItems.length === 0 && !clientFiltering ? (
              <EmptyState
                title="No clans matched"
                body={`Nothing matched "${submitted.name}"${
                  hasActiveFilters ? ' with the current filters' : ''
                }. Check the spelling, or clear the filters and try a shorter name.`}
                action={
                  hasActiveFilters ? <PillButton label="Clear the filters" onPress={clearFilters} /> : undefined
                }
              />
            ) : shownItems.length === 0 ? (
              // The client-side filters emptied everything loaded so far.
              // This is NOT the "no results" state: the listing keeps
              // paginating (the sentinel stays mounted, Load more is
              // offered) so the filters get more clans to match against,
              // and clearing just these filters is one press away.
              <View style={styles.filteredEmptyWrap}>
                <EmptyState
                  title="No clans match these filters yet"
                  body={`None of the ${loadedItems.length} loaded ${
                    loadedItems.length === 1 ? 'clan' : 'clans'
                  } match the extra filters (clan type, chat language, or requirements). ${
                    hasNextPage
                      ? 'More clans load as you scroll, or fetch the next page now.'
                      : 'The listing is exhausted, so nothing else can match.'
                  }`}
                  action={
                    <View style={styles.emptyActions}>
                      {hasNextPage ? (
                        <PillButton
                          label={isFetchingNextPage ? 'Loading more…' : 'Load more clans'}
                          onPress={() => void fetchNextPage()}
                          disabled={isFetchingNextPage}
                          hint="Fetches the next page of the listing so these filters have more clans to match."
                        />
                      ) : null}
                      <PillButton
                        label="Clear these filters"
                        variant="secondary"
                        onPress={clearClientFilters}
                        hint="Drops the clan type, language, and requirement filters, keeping the name and the server-side filters."
                      />
                    </View>
                  }
                />
                {/* The sentinel stays alive here on purpose: an empty view
                    is exactly when the observer must keep pulling pages
                    (the pagination contract, not a dead end). */}
                <View nativeID={sentinelId} aria-hidden />
                <ResultsFooter
                  hasNextPage={query.hasNextPage ?? false}
                  isFetchingNextPage={query.isFetchingNextPage}
                  isFetchNextPageError={query.isFetchNextPageError}
                  failureReason={query.failureReason}
                  onRetry={() => void query.fetchNextPage()}
                />
              </View>
            ) : (
              <>
                {appliedChips.length > 0 ? (
                  <View style={styles.chipsRow} accessibilityLabel="Applied filters">
                    {appliedChips.map((chip) => (
                      <AppliedFilterChip key={chip.key} label={chip.label} onRemove={chip.remove} />
                    ))}
                    <PillButton
                      label="Clear all"
                      variant="secondary"
                      onPress={clearFilters}
                      hint="Resets every filter and re-runs the search with the name alone."
                    />
                  </View>
                ) : null}
                <View style={styles.resultsMeta}>
                  <Text style={base.caption}>
                    {clientFiltering
                      ? `${shownItems.length} shown of ${loadedItems.length} loaded`
                      : shownItems.length === 1
                        ? '1 clan'
                        : `${shownItems.length} clans`}
                  </Text>
                  {/* The manual refresh control (F-19): the hint and the
                      button ride where the quiet age line rode, above the
                      results. The first page's age speaks for the search:
                      a refresh re-issues every loaded page's GET, and the
                      listing's head is the reading a visitor cares about. */}
                  <RefreshControl
                    onRefresh={() => void query.refetch()}
                    ageSeconds={firstPageAge}
                    isRefreshing={query.isFetching && !isFetchingNextPage}
                  />
                </View>
                {/* The results render in page flow: each card is a plain
                    child of the column, the browser scrollbar owns the
                    scrolling, and the sentinel under the last card pulls
                    the next page when it nears the viewport. */}
                {shownItems.map((item) => (
                  <ClanCard key={item.tag} clan={item} onPress={() => navigate(clanRouteFor(item.tag))} />
                ))}
                <View nativeID={sentinelId} aria-hidden />
                <ResultsFooter
                  hasNextPage={query.hasNextPage ?? false}
                  isFetchingNextPage={query.isFetchingNextPage}
                  isFetchNextPageError={query.isFetchNextPageError}
                  failureReason={query.failureReason}
                  onRetry={() => void query.fetchNextPage()}
                />
              </>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

// ---------- the filter number cells ----------

interface FilterNumberCellProps {
  /** Micro label above the box, same rhythm the Dropdown's label carries. */
  label: string;
  /** The draft value; undefined renders empty ("any"). */
  value: number | undefined;
  onValue: (value: number | undefined) => void;
  /** Inclusive bounds the box clamps to while typing, so the draft can
   * never hold a value the tier would reject or the game cannot mean. */
  min: number;
  max: number;
  placeholder: string;
  /** Extra instruction for screen readers. */
  hint: string;
}

// A numeric filter cell for the disclosure grid: the same micro-label-above,
// input-chrome-below rhythm the Dropdown cells carry (the owner's rework of
// the level and Town Hall filters from dropdowns to number boxes), so the
// grid reads as one family of controls. Digits only, clamped to [min, max]
// as they are typed, empty meaning "any" — apply-on-submit stays the
// screen's rule, exactly like a dropdown pick.
function FilterNumberCell({
  label,
  value,
  onValue,
  min,
  max,
  placeholder,
  hint,
}: FilterNumberCellProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createNumberCellStyles(theme), [theme]);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value === undefined ? '' : String(value)}
        onChangeText={(text) => {
          const digits = text.replace(/[^0-9]/g, '');
          if (digits === '') {
            onValue(undefined);
            return;
          }
          const parsed = Number.parseInt(digits, 10);
          onValue(Math.min(Math.max(parsed, min), max));
        }}
        keyboardType="number-pad"
        maxLength={2}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        accessibilityLabel={label}
        accessibilityHint={hint}
        inputMode="numeric"
        style={styles.input}
      />
    </View>
  );
}

function createNumberCellStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    wrap: {
      gap: t.spacing[2],
    },
    // The same micro label the Dropdown and the name box render.
    label: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    // The same input chrome the name input and the Dropdown trigger carry,
    // so the mixed grid reads as one control family.
    input: {
      minHeight: t.layout.touchTargetMin,
      paddingHorizontal: t.spacing[4],
      paddingVertical: t.spacing[2],
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorderStrong,
      backgroundColor: c.panelRaised,
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.md,
      color: c.textPrimary,
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
  });
}

// ---------- applied-filter chips ----------

interface AppliedFilterChipProps {
  label: string;
  onRemove: () => void;
}

function AppliedFilterChip({ label, onRemove }: AppliedFilterChipProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createChipStyles(theme), [theme]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Remove filter: ${label}`}
      accessibilityHint="Clears this one filter and re-runs the search immediately."
      onPress={onRemove}
      style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
    >
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={styles.chipMark} aria-hidden>
        ×
      </Text>
    </Pressable>
  );
}

function createChipStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: t.spacing[2],
      minHeight: t.layout.touchTargetMin,
      paddingHorizontal: t.spacing[4],
      borderRadius: t.radius[1],
      borderWidth: 1,
      borderColor: c.panelBorderStrong,
      backgroundColor: c.panelRaised,
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    chipPressed: {
      backgroundColor: c.panel,
    },
    chipLabel: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.medium,
      color: c.textPrimary,
    },
    chipMark: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.bold,
      color: c.textMuted,
    },
  });
}

// ---------- error copy (this screen's slice of the contract) ----------

interface SearchErrorProps {
  error: SearchFetchError | Error;
  onRetry: () => void;
  isRetrying: boolean;
}

function SearchError({ error, onRetry, isRetrying }: SearchErrorProps) {
  // The contract (04 section 6) hands search three states: upstream_busy,
  // upstream_unreachable, and bad_request. Each gets its own copy and a
  // next action, never a dead end. The busy copy assumes the auto-retry
  // already ran (lib/busy-retry): what is left to offer is the manual
  // nudge and the honest wait.
  let tone: 'busy' | 'gone' = 'gone';
  let title = 'Something went wrong';
  let body = error.message || 'An unexpected error happened while searching.';
  let retryLabel = 'Retry';

  if (error instanceof SearchFetchError) {
    if (error.result.kind === 'busy') {
      tone = 'busy';
      title = 'The game API is busy';
      body = `Upstream answered 429 and automatic retries have not cleared it yet. Trying again now may work, or wait about ${error.result.retryAfter}s and retry.`;
      retryLabel = 'Retry now';
    } else if (error.result.kind === 'unreachable') {
      title = "Can't reach the game API";
      body = 'The proxy or the game API did not answer. This is usually transient; retry in a moment.';
    } else {
      body = `The tier rejected the search: ${error.result.detail}`;
    }
  }

  return (
    <ErrorState
      tone={tone}
      title={title}
      body={body}
      action={
        <PillButton
          label={isRetrying ? 'Retrying…' : retryLabel}
          onPress={onRetry}
          disabled={isRetrying}
        />
      }
    />
  );
}

// ---------- list footer ----------

interface ResultsFooterProps {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  /** True when the last fetchNextPage failed even through its retries;
   * the list above stays, the failure is owned here, inline. */
  isFetchNextPageError: boolean;
  /** The error the pagination attempt ended on, for busy-vs-transient copy. */
  failureReason: SearchFetchError | Error | null;
  onRetry: () => void;
}

function ResultsFooter({
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  failureReason,
  onRetry,
}: ResultsFooterProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createFooterStyles(theme), [theme]);

  if (isFetchingNextPage) {
    // Checked before the error branch on purpose: while a retry is in
    // flight the query status is still the previous error (status only
    // flips on success), so isFetchNextPageError stays true through the
    // whole fetch and the error branch would swallow the loading state.
    // Layout-matched loading for the next page (06 section 3): the same
    // card skeleton the first load uses, two of them, so the list grows by
    // the shape it is about to receive. The row carries the progressbar
    // role because the skeleton blocks themselves are decorative and
    // silent; a screen reader still needs to hear that more is loading.
    return (
      <View
        style={styles.loadingRow}
        accessibilityRole="progressbar"
        accessibilityLabel="Loading more clans"
      >
        {Array.from({ length: SKELETON_FOOTER_CARD_COUNT }, (_, index) => (
          <SkeletonCard key={index} />
        ))}
      </View>
    );
  }

  if (isFetchNextPageError) {
    // A failed page load used to be swallowed: the list just ended, which
    // read as "that was everything". The footer owns the failure instead
    // (STD-35): the loaded clans stay on screen and the retry sits right
    // where the next page would have appeared.
    const busy =
      failureReason instanceof SearchFetchError && failureReason.result.kind === 'busy';
    return (
      <View style={styles.errorRow} accessibilityRole="alert">
        <Text style={styles.errorText}>
          {busy
            ? 'The game API is busy, so the next page of clans is not loading.'
            : 'The request for more clans failed. This is usually transient.'}
        </Text>
        <PillButton
          label="Retry"
          variant="secondary"
          onPress={onRetry}
          hint="Loads the next page of results again, keeping the clans already on screen."
        />
      </View>
    );
  }

  if (!hasNextPage) {
    return <Text style={styles.text}>End of results</Text>;
  }
  return null;
}

function createFooterStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    text: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textMuted,
      textAlign: 'center',
      paddingVertical: t.spacing[4],
    },
    // The skeleton pair sits in the list's own card rhythm (the last card
    // already carries the marginBottom that spaces the footer).
    loadingRow: {
      gap: t.spacing[3],
    },
    errorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      columnGap: t.spacing[3],
      rowGap: t.spacing[2],
      paddingVertical: t.spacing[3],
    },
    errorText: {
      flex: 1,
      // Keeps the sentence readable before the retry button wraps under
      // it on a narrow screen.
      minWidth: 200,
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textSecondary,
    },
  });
}

// ---------- styles ----------

function createStyles(t: ReturnType<typeof useTheme>['theme'], filterCellBasis: number) {
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

    // search panel: the same unit the player tag box renders (label,
    // input row, helper line), so the two lookup panels read as one family
    searchPanel: {
      gap: t.spacing[4],
    },
    nameWrap: {
      gap: t.spacing[2],
    },
    // The micro label above the input, the house pattern TagInput and
    // Dropdown both render (xs, medium, muted, uppercase, tracked).
    nameLabel: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    nameFootnote: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textMuted,
    },
    nameRow: {
      flexDirection: 'row',
      gap: t.spacing[3],
      alignItems: 'stretch',
    },
    nameInput: {
      flex: 1,
      // minWidth 0 lets the input actually shrink: browsers size an empty
      // text input by its intrinsic content width and flex items refuse to
      // go below it, which pushed the Search button off the 360 px
      // compatibility floor (NFR-05) with a horizontal scrollbar.
      minWidth: 0,
      minHeight: t.layout.touchTargetMin,
      paddingHorizontal: t.spacing[4],
      paddingVertical: t.spacing[2],
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorderStrong,
      backgroundColor: c.panelRaised,
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.md,
      color: c.textPrimary,
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    validationHint: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.warning,
    },
    filterToolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      columnGap: t.spacing[3],
      rowGap: t.spacing[2],
    },
    filterGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: t.spacing[3],
      rowGap: t.spacing[3],
    },
    filterCell: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: filterCellBasis,
      minWidth: 0,
    },
    dirtyHint: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.info,
    },

    // results: natural height. The cards render in page flow (the owner's
    // call, the roster tab's scroll model), so this region grows as tall
    // as the results run and the browser scrollbar owns the scrolling.
    resultsArea: {
      marginTop: t.spacing[5],
    },
    // The applied-filter chip row: one removable chip per applied filter
    // (plus Clear all), wrapping on a phone the same way the filter cells
    // do. It sits above the meta line because it describes the search
    // that produced the list.
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: t.spacing[2],
      marginBottom: t.spacing[3],
    },
    resultsMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      // Wraps rather than squeezes: on a narrow phone the refresh control
      // drops under the count line instead of colliding with it.
      flexWrap: 'wrap',
      gap: t.spacing[2],
      marginBottom: t.spacing[2],
    },
    // The emptied-by-client-filters view: the EmptyState, the live
    // sentinel, and the footer stack with the list's own card rhythm.
    filteredEmptyWrap: {
      gap: t.spacing[3],
    },
    emptyActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.spacing[3],
    },
    skeletonWrap: {
      gap: t.spacing[3],
    },
    skeletonNote: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textMuted,
    },
  });
}
