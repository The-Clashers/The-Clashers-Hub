import { useMemo, useState, type ReactNode } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigate } from 'react-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTheme, createBaseStyles } from '../theme';
import { ThemeToggle } from '../components/ThemeToggle';
import TagInput from '../components/TagInput';
import Dropdown from '../components/Dropdown';
import {
  fetchSearchPage,
  SearchFetchError,
  type SearchClanItem,
  type SearchFilters,
  type SearchPage,
  type WarFrequency,
} from '../api/search';
import { LOCATION_FILTERS } from '../api/locations';

// The search screen (T-M1-1, FR-01, SR-08). A visitor types a clan name,
// optionally narrows it with the filter row (minimum members, minimum clan
// level, war frequency, location), submits, and gets a virtualized card list
// that pages through the upstream cursor as it scrolls. Every screen state
// the design language requires is here: loading skeleton, error branches
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

const FREQUENCY_OPTIONS: ReadonlyArray<{ label: string; value: WarFrequency | undefined }> = [
  { label: 'Any', value: undefined },
  { label: 'Always', value: 'always' },
  { label: '2+ per week', value: 'moreThanOncePerWeek' },
  { label: 'Weekly', value: 'oncePerWeek' },
  { label: 'Under weekly', value: 'lessThanOncePerWeek' },
  { label: 'Never', value: 'never' },
];

const LOCATION_OPTIONS: ReadonlyArray<{ label: string; value: number | undefined }> = [
  { label: 'Any', value: undefined },
  ...LOCATION_FILTERS.map((location) => ({ label: location.name, value: location.id })),
];

const WAR_FREQUENCY_LABELS: Record<string, string> = {
  always: 'Always',
  moreThanOncePerWeek: '2+ per week',
  oncePerWeek: 'Weekly',
  lessThanOncePerWeek: 'Under weekly',
  never: 'Never',
};

function warFrequencyLabel(raw: string | undefined): string {
  if (raw === undefined) return 'Unknown';
  return WAR_FREQUENCY_LABELS[raw] ?? raw;
}

function filtersEqual(a: SearchFilters, b: SearchFilters): boolean {
  return (
    a.name === b.name &&
    a.minMembers === b.minMembers &&
    a.minClanLevel === b.minClanLevel &&
    a.warFrequency === b.warFrequency &&
    a.locationId === b.locationId
  );
}

function clanHref(tag: string): string {
  return `/clan/${encodeURIComponent(tag)}`;
}

// The client staleTime mirrors the tier's 60 s search TTL (SR-08) so the two
// cache layers decay together, the same pairing the hello screen uses.
const SEARCH_STALE_TIME_MS = 60_000;

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
  const [emptyName, setEmptyName] = useState(false);
  // null until the first submit: the screen starts in the idle state, not in
  // loading. The query is disabled while this is null.
  const [submitted, setSubmitted] = useState<SearchFilters | null>(null);

  const draftFilters = useMemo<SearchFilters>(
    () => ({ name: nameDraft.trim(), minMembers, minClanLevel, warFrequency, locationId }),
    [nameDraft, minMembers, minClanLevel, warFrequency, locationId],
  );
  const dirty = submitted !== null && !filtersEqual(submitted, draftFilters);

  const submit = () => {
    const name = nameDraft.trim();
    if (name.length < 1) {
      setEmptyName(true);
      return;
    }
    setEmptyName(false);
    setSubmitted({ name, minMembers, minClanLevel, warFrequency, locationId });
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
      // fix it, so we stop. Everything else gets the single default retry
      // (the tier already retries upstream throttles itself).
      if (error instanceof SearchFetchError && error.result.kind === 'bad_request') {
        return false;
      }
      return failureCount < 1;
    },
  });

  const items = useMemo(
    () => (query.data ? query.data.pages.flatMap((page) => page.items) : []),
    [query.data],
  );
  const firstPageAge = query.data?.pages[0]?.age ?? 0;

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
              <Text style={base.subtitle}>Live data, no login. Filters are optional.</Text>
            </View>
            <ThemeToggle />
          </View>

          <View style={[base.panelRaised, styles.searchPanel]}>
            <View style={styles.nameRow}>
              <TextInput
                value={nameDraft}
                onChangeText={(text) => {
                  setNameDraft(text);
                  if (emptyName && text.trim().length > 0) setEmptyName(false);
                }}
                onSubmitEditing={submit}
                placeholder="Clan name"
                placeholderTextColor={theme.colors.textMuted}
                accessibilityLabel="Clan name"
                accessibilityHint="Type part of a clan name and press Search."
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={64}
                style={styles.nameInput}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Search clans"
                accessibilityHint="Runs the search with the current name and filters."
                onPress={submit}
                style={({ pressed }) => [styles.searchButton, pressed && styles.searchButtonPressed]}
              >
                <Text style={styles.searchButtonText}>Search</Text>
              </Pressable>
            </View>
            {emptyName ? (
              <Text style={styles.validationHint}>Type a clan name first.</Text>
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
              <View style={styles.statePanel}>
                <Text style={base.title}>Find a clan</Text>
                <Text style={base.body}>
                  Type a clan name and press Search. Filters are optional and apply
                  when you search.
                </Text>
              </View>
            ) : query.isPending ? (
              <ResultsSkeleton styles={styles} />
            ) : query.isError ? (
              <SearchError
                error={query.error as SearchFetchError | Error}
                onRetry={() => void query.refetch()}
                isRetrying={query.isFetching}
                base={base}
                styles={styles}
              />
            ) : items.length === 0 ? (
              <View style={styles.statePanel}>
                <Text style={base.title}>No clans matched</Text>
                <Text style={base.body}>
                  Nothing matched "{submitted.name}"
                  {hasActiveFilters ? ' with the current filters' : ''}. Check the
                  spelling, or clear the filters and try a shorter name.
                </Text>
                {hasActiveFilters ? (
                  <View style={styles.statePanelAction}>
                    <ActionButton label="Clear the filters" onPress={clearFilters} styles={styles} />
                  </View>
                ) : null}
              </View>
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
                    <ClanCard
                      clan={item}
                      onPress={() => navigate(clanHref(item.tag))}
                      styles={styles}
                    />
                  )}
                  onEndReached={() => {
                    if (query.hasNextPage && !query.isFetchingNextPage) {
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
                      styles={styles}
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
              <FooterLink
                label="Hello, clan"
                hint="Opens /hello, a hardcoded clan tag rendered from live data."
                primary
                onPress={() => navigate('/hello')}
                styles={styles}
              />
              <FooterLink
                label="Review the tokens"
                hint="Opens /tokens, the design token review surface."
                primary={false}
                onPress={() => navigate('/tokens')}
                styles={styles}
              />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

// ---------- result card ----------

interface ClanCardProps {
  clan: SearchClanItem;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}

function ClanCard({ clan, onPress, styles }: ClanCardProps) {
  // The badge is an API icon rendered in a fixed slot (07 section 7) so a
  // slow CDN load never reflows the card. Missing badges get a quiet block.
  const badgeUri = clan.badgeUrls?.medium || clan.badgeUrls?.small;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${clan.name}, level ${clan.clanLevel}, ${clan.members} members`}
      accessibilityHint="Opens the clan detail screen."
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      {badgeUri ? (
        <Image
          source={{ uri: badgeUri }}
          style={styles.cardBadge}
          accessibilityLabel={`${clan.name} clan badge`}
        />
      ) : (
        <View
          style={[styles.cardBadge, styles.cardBadgeEmpty]}
          accessibilityLabel={`${clan.name} clan badge`}
        />
      )}
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardName} numberOfLines={1}>
            {clan.name}
          </Text>
          <Text style={styles.cardTag} numberOfLines={1}>
            {clan.tag}
          </Text>
        </View>
        <View style={styles.cardStatRow}>
          <CardStat label="Level" value={String(clan.clanLevel)} styles={styles} />
          <CardStat label="Members" value={String(clan.members)} styles={styles} />
          <CardStat label="Location" value={clan.locationName ?? 'No location'} styles={styles} />
          <CardStat label="War" value={warFrequencyLabel(clan.warFrequency)} styles={styles} />
        </View>
      </View>
    </Pressable>
  );
}

interface CardStatProps {
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
}

function CardStat({ label, value, styles }: CardStatProps) {
  return (
    <View style={styles.cardStat}>
      <Text style={styles.cardStatLabel}>{label}</Text>
      <Text style={styles.cardStatValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

// ---------- loading ----------

interface SkeletonProps {
  styles: ReturnType<typeof createStyles>;
}

function ResultsSkeleton({ styles }: SkeletonProps) {
  // Layout-matched skeleton (06 section 3): the same card shape six times,
  // pulsing quietly. No spinner; the layout is the signal.
  return (
    <View
      style={styles.skeletonWrap}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading search results"
    >
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <View key={index} style={styles.skeletonCard}>
          <View style={[styles.cardBadge, styles.skeletonBlock]} />
          <View style={styles.cardBody}>
            <View style={[styles.skeletonLine, styles.skeletonName]} />
            <View style={[styles.skeletonLine, styles.skeletonStats]} />
          </View>
        </View>
      ))}
    </View>
  );
}

interface ResultsFooterProps {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  styles: ReturnType<typeof createStyles>;
}

function ResultsFooter({ hasNextPage, isFetchingNextPage, styles }: ResultsFooterProps) {
  if (isFetchingNextPage) {
    return <Text style={styles.listFooterText}>Loading more clans…</Text>;
  }
  if (!hasNextPage) {
    return <Text style={styles.listFooterText}>End of results</Text>;
  }
  return null;
}

// ---------- error ----------

interface SearchErrorProps {
  error: SearchFetchError | Error;
  onRetry: () => void;
  isRetrying: boolean;
  base: ReturnType<typeof createBaseStyles>;
  styles: ReturnType<typeof createStyles>;
}

function SearchError({ error, onRetry, isRetrying, base, styles }: SearchErrorProps) {
  // The contract (04 section 6) hands search three states: upstream_busy,
  // upstream_unreachable, and bad_request. Each gets its own copy and a next
  // action, never a dead end.
  if (error instanceof SearchFetchError) {
    if (error.result.kind === 'busy') {
      return (
        <ErrorBody
          tone="busy"
          title="The game API is busy"
          body={`Upstream answered 429. Trying again in about ${error.result.retryAfter}s, or hit retry to nudge it.`}
          action={
            <ActionButton
              label={isRetrying ? 'Retrying…' : 'Retry now'}
              onPress={onRetry}
              disabled={isRetrying}
              styles={styles}
            />
          }
          base={base}
          styles={styles}
        />
      );
    }
    if (error.result.kind === 'unreachable') {
      return (
        <ErrorBody
          tone="gone"
          title="Can't reach the game API"
          body="The proxy or the game API did not answer. This is usually transient; retry in a moment."
          action={
            <ActionButton
              label={isRetrying ? 'Retrying…' : 'Retry'}
              onPress={onRetry}
              disabled={isRetrying}
              styles={styles}
            />
          }
          base={base}
          styles={styles}
        />
      );
    }
    return (
      <ErrorBody
        tone="gone"
        title="Something went wrong"
        body={`The tier rejected the search: ${error.result.detail}`}
        action={
          <ActionButton
            label={isRetrying ? 'Retrying…' : 'Retry'}
            onPress={onRetry}
            disabled={isRetrying}
            styles={styles}
          />
        }
        base={base}
        styles={styles}
      />
    );
  }
  return (
    <ErrorBody
      tone="gone"
      title="Something went wrong"
      body={error.message || 'An unexpected error happened while searching.'}
      action={
        <ActionButton
          label={isRetrying ? 'Retrying…' : 'Retry'}
          onPress={onRetry}
          disabled={isRetrying}
          styles={styles}
        />
      }
      base={base}
      styles={styles}
    />
  );
}

interface ErrorBodyProps {
  tone: 'busy' | 'gone';
  title: string;
  body: string;
  action: ReactNode | null;
  base: ReturnType<typeof createBaseStyles>;
  styles: ReturnType<typeof createStyles>;
}

function ErrorBody({ tone, title, body, action, base, styles }: ErrorBodyProps) {
  return (
    <View style={styles.statePanel} accessibilityRole="alert">
      <View style={styles.errorRow}>
        <View style={[styles.toneDot, tone === 'busy' ? styles.toneBusy : styles.toneGone]} />
        <View style={styles.errorText}>
          <Text style={base.title}>{title}</Text>
          <Text style={base.body}>{body}</Text>
        </View>
      </View>
      {action ? <View style={styles.statePanelAction}>{action}</View> : null}
    </View>
  );
}

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  styles: ReturnType<typeof createStyles>;
}

function ActionButton({ label, onPress, disabled = false, styles }: ActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionButton,
        pressed && styles.actionButtonPressed,
        disabled && styles.actionButtonDisabled,
      ]}
    >
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
  );
}

// ---------- footer links (M0 review surfaces) ----------

interface FooterLinkProps {
  label: string;
  hint: string;
  primary: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}

function FooterLink({ label, hint, primary, onPress, styles }: FooterLinkProps) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.footerLink,
        primary ? styles.footerLinkPrimary : styles.footerLinkSecondary,
        pressed && styles.footerLinkPressed,
      ]}
    >
      <Text style={[styles.footerLinkText, !primary && styles.footerLinkTextSecondary]}>
        {label}
      </Text>
      <Text
        style={[styles.footerLinkArrow, !primary && styles.footerLinkTextSecondary]}
        aria-hidden
      >
        {' ->'}
      </Text>
    </Pressable>
  );
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
    searchButton: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: t.layout.touchTargetMin,
      paddingHorizontal: t.spacing[6],
      paddingVertical: t.spacing[2],
      borderRadius: t.radius.pill,
      backgroundColor: c.accent,
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    searchButtonPressed: {
      backgroundColor: c.accentPressed,
    },
    searchButtonText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.body,
      fontWeight: t.fontWeight.semibold,
      color: c.textOnAccent,
    },
    validationHint: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.warning,
    },
    // The four filter dropdowns wrap on their own: two per row on a phone,
    // one row of four from tablet up. flexBasis drives the break, so no
    // breakpoint JS and no media queries; cells grow to share the row.
    filterGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: t.spacing[3],
      rowGap: t.spacing[3],
    },
    filterCell: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 140,
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
    listFooterText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textMuted,
      textAlign: 'center',
      paddingVertical: t.spacing[4],
    },

    // result card
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing[4],
      padding: t.spacing[4],
      marginBottom: t.spacing[3],
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorder,
      backgroundColor: c.panelRaised,
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    cardPressed: {
      backgroundColor: c.panel,
      borderColor: c.panelBorderStrong,
    },
    cardBadge: {
      width: 48,
      height: 48,
      borderRadius: t.radius[2],
      backgroundColor: c.panel,
    },
    cardBadgeEmpty: {
      backgroundColor: c.hairline,
    },
    cardBody: {
      flex: 1,
      gap: t.spacing[2],
    },
    cardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing[3],
    },
    cardName: {
      flexShrink: 1,
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.md,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
    },
    cardTag: {
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.xs,
      color: c.textMuted,
    },
    cardStatRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: t.spacing[5],
      rowGap: t.spacing[2],
    },
    cardStat: {
      minWidth: 88,
      gap: t.spacing[1],
    },
    cardStatLabel: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    cardStatValue: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.medium,
      color: c.textPrimary,
      fontVariant: ['tabular-nums'],
    },

    // idle and empty states
    statePanel: {
      alignSelf: 'stretch',
      gap: t.spacing[3],
      padding: t.spacing[6],
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorder,
      backgroundColor: c.panel,
    },
    statePanelAction: {
      marginTop: t.spacing[2],
    },

    // skeleton, kept quiet per the design language
    skeletonWrap: {
      gap: t.spacing[3],
    },
    skeletonCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing[4],
      padding: t.spacing[4],
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorder,
      backgroundColor: c.panelRaised,
    },
    skeletonBlock: {
      backgroundColor: c.hairline,
    },
    skeletonLine: {
      backgroundColor: c.hairline,
      borderRadius: t.radius[1],
    },
    skeletonName: {
      height: t.fontSize.md,
      width: 200,
    },
    skeletonStats: {
      height: t.fontSize.sm,
      width: 280,
      marginTop: t.spacing[2],
    },

    // error layout
    errorRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: t.spacing[3],
      flexWrap: 'wrap',
    },
    errorText: {
      flex: 1,
      minWidth: 240,
      gap: t.spacing[2],
    },
    toneDot: {
      width: 10,
      height: 10,
      borderRadius: 9999,
      marginTop: t.spacing[2],
    },
    toneBusy: {
      backgroundColor: c.warning,
    },
    toneGone: {
      backgroundColor: c.danger,
    },
    actionButton: {
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'flex-start',
      minHeight: t.layout.touchTargetMin,
      paddingHorizontal: t.spacing[5],
      paddingVertical: t.spacing[2],
      borderRadius: t.radius.pill,
      backgroundColor: c.accent,
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    actionButtonPressed: {
      backgroundColor: c.accentPressed,
    },
    actionButtonDisabled: {
      opacity: 0.5,
    },
    actionButtonText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.body,
      fontWeight: t.fontWeight.semibold,
      color: c.textOnAccent,
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
    footerLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing[2],
      alignSelf: 'flex-start',
      minHeight: t.layout.touchTargetMin,
      paddingHorizontal: t.spacing[5],
      paddingVertical: t.spacing[2],
      borderRadius: t.radius.pill,
      backgroundColor: c.accent,
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    footerLinkPrimary: {
      backgroundColor: c.accent,
    },
    footerLinkSecondary: {
      backgroundColor: c.panelRaised,
      borderWidth: 1,
      borderColor: c.panelBorderStrong,
    },
    footerLinkPressed: {
      backgroundColor: c.accentPressed,
    },
    footerLinkText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.body,
      fontWeight: t.fontWeight.semibold,
      color: c.textOnAccent,
    },
    footerLinkTextSecondary: {
      color: c.textPrimary,
    },
    footerLinkArrow: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.body,
      fontWeight: t.fontWeight.bold,
      color: c.textOnAccent,
    },
  });
}
