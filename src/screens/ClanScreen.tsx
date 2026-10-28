import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useParams, useSearchParams, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTheme, createBaseStyles } from '../theme';
import { ThemeToggle } from '../components/ThemeToggle';
import StatChip from '../components/StatChip';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import PillButton from '../components/PillButton';
import { fetchClan, ClanFetchError } from '../api/clan';
import { warFrequencyLabel } from '../lib/war-frequency';

// The clan detail screen (T-M1-3, FR-03, SR-10). The search result cards and
// the search bar's #tag path both land here. The screen owns layout and the
// route's state; the pieces it renders come from the shared kit (07 section 4):
// StatChip for the stat row, ErrorState for the contract's three failure
// kinds, EmptyState for the designed "this tab lands later" placeholder,
// PillButton for the retry and back-to-search actions, ThemeToggle for the
// header. Every state the design language requires is designed (06 section
// 3): a layout-matched loading skeleton, the contract's three error states
// (not_found, busy, unreachable) plus bad_request, and the success state with
// the identity block, the stat chips, and the tab bar.
//
// The tab bar reads `?tab=` from the URL (03 section 2 "Screens & URLs") so a
// deep link to the War or Log tab is shareable (F-12). Roster is the default
// when the param is absent or holds an unknown value. The tab content itself
// is a designed placeholder for this card: the roster table lands in T-M1-4,
// the War and Log views land in M3. The identity block and the stat chips
// above the tabs are this card's full scope; the placeholders make clear what
// lands where so the screen is reviewable end to end today.

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
              <TabPlaceholder tab={activeTab} />
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

// ---------- loading skeleton ----------

interface ClanSkeletonProps {
  base: ReturnType<typeof createBaseStyles>;
  styles: ReturnType<typeof createStyles>;
}

function ClanSkeleton({ base, styles }: ClanSkeletonProps) {
  // Layout-matched skeleton (06 section 3): same shape as the success state
  // (badge, name, tag, meta line, description, requirements, stat row) so the
  // swap from skeleton to data does not reflow. No spinner; the layout is the
  // signal that data is on its way.
  return (
    <View style={styles.successWrap} accessibilityRole="progressbar" accessibilityLabel="Loading clan">
      <View style={styles.identity}>
        <View style={[styles.badge, styles.skeletonBlock]} />
        <View style={styles.identityText}>
          <View style={[styles.skeletonLine, styles.skeletonTitle]} />
          <View style={[styles.skeletonLine, styles.skeletonTag]} />
          <View style={[styles.skeletonLine, styles.skeletonMeta]} />
        </View>
      </View>
      <View style={[styles.skeletonLine, styles.skeletonDescription]} />
      <View style={styles.requirementsRow}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.requirementChip}>
            <View style={[styles.skeletonLine, styles.skeletonReqLabel]} />
            <View style={[styles.skeletonLine, styles.skeletonReqValue]} />
          </View>
        ))}
      </View>
      <View style={styles.statRow}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.skeletonStat}>
            <View style={[styles.skeletonLine, styles.skeletonStatLabel]} />
            <View style={[styles.skeletonLine, styles.skeletonStatValue]} />
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

// ---------- tab content placeholder ----------

interface TabPlaceholderProps {
  tab: ClanTab;
}

function TabPlaceholder({ tab }: TabPlaceholderProps) {
  // The tab content lands in later cards: the roster table in T-M1-4, the
  // War and Log views in M3. The placeholder is designed (06 section 3
  // "empty"): titled, explained, and pointing at the card that fills it, so
  // the screen reads end to end today and a reviewer knows what is missing
  // by design rather than by oversight.
  if (tab === 'roster') {
    return (
      <EmptyState
        title="Roster lands next"
        body="The roster table (sortable columns, donation flags, tap-through to the player) is T-M1-4. The clan response already carries the full member list, so this tab reads from the same single fetch."
      />
    );
  }
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

    // tab content
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
    // mirror the success layout so the swap does not reflow.
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
    skeletonTag: {
      height: t.fontSize.sm,
      width: 140,
      marginTop: t.spacing[1],
    },
    skeletonMeta: {
      height: t.fontSize.xs,
      width: 180,
      marginTop: t.spacing[2],
    },
    skeletonDescription: {
      height: Math.round(t.lineHeight.relaxed * t.fontSize.body) * 2,
      width: '100%',
    },
    skeletonReqLabel: {
      height: t.fontSize.xs,
      width: 64,
    },
    skeletonReqValue: {
      height: t.fontSize.sm,
      width: 80,
      marginTop: t.spacing[1],
    },
    skeletonStat: {
      gap: t.spacing[1],
    },
    skeletonStatLabel: {
      height: t.fontSize.xs,
      width: 72,
    },
    skeletonStatValue: {
      height: t.fontSize.sm,
      width: 56,
    },
    skeletonCaption: {
      marginTop: t.spacing[1],
    },
  });
}
