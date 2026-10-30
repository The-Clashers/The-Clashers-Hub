import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigate } from 'react-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTheme, createBaseStyles } from '../theme';
import { ThemeToggle } from '../components/ThemeToggle';
import TagInput from '../components/TagInput';
import Dropdown from '../components/Dropdown';
import ClanCard from '../components/ClanCard';
import SkeletonCard from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import PillButton from '../components/PillButton';
import { clanRouteFor, normalizeTagInput, TAG_REJECT_COPY } from '../lib/tag';
import { WAR_FREQUENCY_LABELS } from '../lib/war-frequency';
import { busyRetryDelayMs, shouldRetryBusy } from '../lib/busy-retry';
import {
  fetchSearchPage,
  SearchFetchError,
  type SearchFilters,
  type SearchPage,
  type WarFrequency,
} from '../api/search';
import { LOCATION_FILTERS } from '../api/locations';

// The search screen (T-M1-1, FR-01, SR-08). A visitor types a clan name
// OR pastes a clan tag (the # prefix is what tells the two apart, since
// names and bare tags share the same alphabet), optionally narrows a name
// search with the filter row (minimum members, minimum clan level, war
// frequency, location), submits, and gets a virtualized card list that
// pages through the upstream cursor as it scrolls. A tag skips the listing
// entirely and opens the clan detail screen directly, the same destination
// the result cards link to.
//
// The screen owns layout, composition, and the route's state; the pieces it
// renders come from the shared kit (07 section 4): ClanCard, SkeletonCard,
// EmptyState, ErrorState, PillButton, TagInput, Dropdown. Every state the
// design language requires is designed: loading skeleton, error branches
// with a next action, empty results with a relax-filters suggestion, and
// the success list.
//
// Two behaviors are deliberate and load-bearing:
//
// - Filters apply on submit, not while they are picked. Every distinct
//   filter combination is a distinct cache key on the tier, so live
//   re-searching on every change would burn upstream calls the TTL cache
//   cannot absorb. A "changed since the last search" hint keeps that honest.
// - The FlatList owns the page scrolling (the header and filter row stay
//   put) because virtualization needs the list to be the scroll container.

// ---------- filter option tables ----------

const MEMBER_OPTIONS: ReadonlyArray<{ label: string; value: number | undefined }> = [
  { label: 'Any', value: undefined },
  ...[10, 20, 30, 40, 50].map((value) => ({ label: String(value), value })),
];

const LEVEL_OPTIONS: ReadonlyArray<{ label: string; value: number | undefined }> = [
  { label: 'Any', value: undefined },
  ...[5, 10, 15, 20].map((value) => ({ label: String(value), value })),
];

// The dropdown offers the same labels the result card's War stat renders,
// from the one shared table in lib/war-frequency.ts.
const FREQUENCY_OPTIONS: ReadonlyArray<{ label: string; value: WarFrequency | undefined }> = [
  { label: 'Any', value: undefined },
  ...(Object.keys(WAR_FREQUENCY_LABELS) as WarFrequency[]).map((value) => ({
    label: WAR_FREQUENCY_LABELS[value],
    value,
  })),
];

const LOCATION_OPTIONS: ReadonlyArray<{ label: string; value: number | undefined }> = [
  { label: 'Any', value: undefined },
  ...LOCATION_FILTERS.map((location) => ({ label: location.name, value: location.id })),
];

function filtersEqual(a: SearchFilters, b: SearchFilters): boolean {
  return (
    a.name === b.name &&
    a.minMembers === b.minMembers &&
    a.minClanLevel === b.minClanLevel &&
    a.warFrequency === b.warFrequency &&
    a.locationId === b.locationId
  );
}

// The client staleTime mirrors the tier's 60 s search TTL (SR-08) so the two
// cache layers decay together, the same pairing the hello screen uses.
const SEARCH_STALE_TIME_MS = 60_000;

// The four filter dropdowns wrap on their own: two per row on a phone, one
// row of four from tablet up. flexBasis drives the break, so no breakpoint
// JS and no media queries; cells grow to share the row.
const FILTER_CELL_BASIS = 140;

// Six skeleton cards fill the fold without implying anything about how many
// results are coming.
const SKELETON_CARD_COUNT = 6;

// Two skeleton cards while the next page loads: enough to say "more of the
// same is coming" without implying a page size.
const SKELETON_FOOTER_CARD_COUNT = 2;

// ---------- the screen ----------

export default function SearchScreen() {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigate = useNavigate();

  const [nameDraft, setNameDraft] = useState('');
  const [minMembers, setMinMembers] = useState<number | undefined>(undefined);
  const [minClanLevel, setMinClanLevel] = useState<number | undefined>(undefined);
  const [warFrequency, setWarFrequency] = useState<WarFrequency | undefined>(undefined);
  const [locationId, setLocationId] = useState<number | undefined>(undefined);
  // The one hint line under the search bar: the empty prompt on a blank
  // submit, or the tag rule's sentence when a # input is not a valid tag.
  // Null when there is nothing to complain about.
  const [searchHint, setSearchHint] = useState<string | null>(null);
  // null until the first submit: the screen starts in the idle state, not in
  // loading. The query is disabled while this is null.
  const [submitted, setSubmitted] = useState<SearchFilters | null>(null);

  const draftFilters = useMemo<SearchFilters>(
    () => ({ name: nameDraft.trim(), minMembers, minClanLevel, warFrequency, locationId }),
    [nameDraft, minMembers, minClanLevel, warFrequency, locationId],
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
    setSearchHint(null);
    setSubmitted({ name: raw, minMembers, minClanLevel, warFrequency, locationId });
  };

  const clearFilters = () => {
    setMinMembers(undefined);
    setMinClanLevel(undefined);
    setWarFrequency(undefined);
    setLocationId(undefined);
    setSubmitted((previous) => (previous === null ? previous : { name: previous.name }));
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

  const items = useMemo(
    () => (query.data ? query.data.pages.flatMap((page) => page.items) : []),
    [query.data],
  );
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
      submitted.minClanLevel !== undefined ||
      submitted.warFrequency !== undefined ||
      submitted.locationId !== undefined);

  return (
    <View style={base.appRoot}>
      <View style={base.screen}>
        <View style={[base.contentColumn, styles.column]}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={base.micro}>The Clashers Hub</Text>
              <Text style={base.display}>Search a clan</Text>
            </View>
            <ThemeToggle />
          </View>

          <View style={[base.panelRaised, styles.searchPanel]}>
            <View style={styles.nameRow}>
              <TextInput
                value={nameDraft}
                onChangeText={(text) => {
                  setNameDraft(text);
                  // Clear the hint as soon as the problem is fixed: a name
                  // once the input is non-blank, a # input once it
                  // normalizes to a valid tag. Mirrors the tag box's
                  // clear-on-fix so both inputs behave the same.
                  if (searchHint === null) return;
                  const trimmed = text.trim();
                  const fixed = trimmed.startsWith('#')
                    ? normalizeTagInput(trimmed).ok
                    : trimmed.length > 0;
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

            <View style={styles.filterGrid}>
              <View style={styles.filterCell}>
                <Dropdown
                  label="Minimum members"
                  options={MEMBER_OPTIONS}
                  value={minMembers}
                  onSelect={setMinMembers}
                />
              </View>
              <View style={styles.filterCell}>
                <Dropdown
                  label="Minimum clan level"
                  options={LEVEL_OPTIONS}
                  value={minClanLevel}
                  onSelect={setMinClanLevel}
                />
              </View>
              <View style={styles.filterCell}>
                <Dropdown
                  label="War frequency"
                  options={FREQUENCY_OPTIONS}
                  value={warFrequency}
                  onSelect={setWarFrequency}
                />
              </View>
              <View style={styles.filterCell}>
                <Dropdown
                  label="Location"
                  options={LOCATION_OPTIONS}
                  value={locationId}
                  onSelect={setLocationId}
                />
              </View>
            </View>
            {dirty ? (
              <Text style={styles.dirtyHint}>
                Changed since the last search. Press Search to apply.
              </Text>
            ) : null}
          </View>

          <View style={[base.panel, styles.tagPanel]}>
            <TagInput />
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
            ) : items.length === 0 ? (
              <EmptyState
                title="No clans matched"
                body={`Nothing matched "${submitted.name}"${
                  hasActiveFilters ? ' with the current filters' : ''
                }. Check the spelling, or clear the filters and try a shorter name.`}
                action={
                  hasActiveFilters ? <PillButton label="Clear the filters" onPress={clearFilters} /> : undefined
                }
              />
            ) : (
              <>
                <View style={styles.resultsMeta}>
                  <Text style={base.caption}>
                    {items.length === 1 ? '1 clan' : `${items.length} clans`}
                  </Text>
                  <Text style={base.caption}>fetched {firstPageAge}s ago</Text>
                </View>
                <FlatList
                  data={items}
                  keyExtractor={(item) => item.tag}
                  renderItem={({ item }) => (
                    <ClanCard clan={item} onPress={() => navigate(clanRouteFor(item.tag))} />
                  )}
                  onEndReached={() => {
                    if (query.hasNextPage && !query.isFetchingNextPage && !query.isFetchNextPageError) {
                      void query.fetchNextPage();
                    }
                  }}
                  onEndReachedThreshold={0.4}
                  initialNumToRender={8}
                  maxToRenderPerBatch={12}
                  ListFooterComponent={
                    <ResultsFooter
                      hasNextPage={query.hasNextPage ?? false}
                      isFetchingNextPage={query.isFetchingNextPage}
                      isFetchNextPageError={query.isFetchNextPageError}
                      failureReason={query.failureReason}
                      onRetry={() => void query.fetchNextPage()}
                    />
                  }
                  contentContainerStyle={styles.listContent}
                  style={styles.list}
                />
              </>
            )}
          </View>

          <View style={styles.footer}>
            <Text style={base.caption}>
              M0 review surfaces stay reachable from the entry route.
            </Text>
            <View style={styles.footerLinkRow}>
              <PillButton
                label="Hello, clan"
                hint="Opens /hello, a hardcoded clan tag rendered from live data."
                role="link"
                arrow
                onPress={() => navigate('/hello')}
              />
              <PillButton
                label="Review the tokens"
                hint="Opens /tokens, the design token review surface."
                role="link"
                arrow
                variant="secondary"
                onPress={() => navigate('/tokens')}
              />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
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

    // search panel
    searchPanel: {
      gap: t.spacing[4],
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
    filterGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: t.spacing[3],
      rowGap: t.spacing[3],
    },
    filterCell: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: FILTER_CELL_BASIS,
      minWidth: 0,
    },
    dirtyHint: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.info,
    },
    // The tag-lookup panel sits between the search panel and the results.
    // It is the entry point for golden path B (paste a tag, land on the
    // player). Quiet chrome: a flat panel, not raised, so the search panel
    // stays the primary surface.
    tagPanel: {
      marginTop: t.spacing[4],
      padding: t.spacing[4],
    },

    // results
    resultsArea: {
      flex: 1,
      minHeight: 240,
      marginTop: t.spacing[5],
    },
    resultsMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: t.spacing[2],
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingBottom: t.spacing[6],
    },
    skeletonWrap: {
      gap: t.spacing[3],
    },
    skeletonNote: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textMuted,
    },

    // footer (M0 review surfaces)
    footer: {
      marginTop: t.spacing[6],
      gap: t.spacing[2],
    },
    footerLinkRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.spacing[3],
    },
  });
}
