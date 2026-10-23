import { useMemo, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTheme, createBaseStyles } from '../theme';
import { ThemeToggle } from '../components/ThemeToggle';
import { fetchClan, ClanFetchError } from '../api/clan';

// The hello clan screen (T-M0-5). A hardcoded tag, fetched live through the
// tier, rendered with every state the design language requires (06
// "State matrix"): a layout-matched loading skeleton, the three error
// states the contract hands the client (not_found, upstream_busy,
// upstream_unreachable), and the success state. It is the M0 milestone's
// smoke test that the request path works end to end: browser, our own
// /api route, the proxy, the game API, back.
//
// The screen is a review surface, not a feature. The real clan detail screen
// (F-04) lands in M1 and takes its tag from the route; this one takes its
// tag from a constant so the smoke test never depends on the user pasting
// something valid. When M1 lands, the M1 clan screen replaces this on the
// route table, but the same state matrix and the same typed client carry
// over.

// The hardcoded tag. Picked for three properties that make the smoke test
// stable: it is our own clan (so it exists as long as the project does and
// the whole team tests against it), it is populated (47 members, so the
// members count reads as a real number, not a confusing zero), and its war
// log is public (verified live: the warlog route answers 200 against it, so
// a later session can probe that route on the same tag without surprises).
// Changing this is a one-line edit; the tag is canonical (leading #,
// uppercase) so the tier's normalization is a no-op on it.
const HARDCODED_CLAN_TAG = '#2JPCYP98L';

const CLAN_QUERY_KEY = ['clan', HARDCODED_CLAN_TAG] as const;
const CLAN_STALE_TIME_MS = 180_000;

export default function HelloClanScreen() {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const query = useQuery({
    queryKey: CLAN_QUERY_KEY,
    queryFn: () => fetchClan(HARDCODED_CLAN_TAG),
    staleTime: CLAN_STALE_TIME_MS,
    retry: (failureCount, error) => {
      // A 404 is permanent for a hardcoded tag (the clan was retired); retrying
      // burns no upstream calls thanks to the 30 s negative cache, but it also
      // cannot fix anything, so we stop. A 503 (upstream_busy) is retried once
      // by the default query-client policy; the screen surfaces the retryAfter
      // hint in the meantime. Everything else gets the single default retry.
      if (error instanceof ClanFetchError && error.result.kind === 'not_found') {
        return false;
      }
      return failureCount < 1;
    },
  });

  return (
    <View style={base.appRoot}>
      <View style={base.screen}>
        <View style={base.contentColumn}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={base.micro}>T-M0-5 smoke</Text>
              <Text style={base.display}>Hello, clan</Text>
              <Text style={base.subtitle}>
                A hardcoded tag, fetched live through the tier. The search
                flow lands in M1; this is the milestone's proof the request
                path works end to end.
              </Text>
            </View>
            <ThemeToggle />
          </View>

          <View style={[base.panelRaised, styles.clanPanel]}>
            {query.isPending ? (
              <ClanSkeleton base={base} styles={styles} />
            ) : query.isError ? (
              <ClanError
                error={query.error as ClanFetchError | Error}
                onRetry={() => void query.refetch()}
                isRetrying={query.isFetching}
                base={base}
                styles={styles}
              />
            ) : (
              <ClanSuccess clan={query.data} base={base} styles={styles} />
            )}
          </View>

          <View style={styles.footer}>
            <Text style={base.caption}>
              Tag {HARDCODED_CLAN_TAG} is hardcoded in src/screens/HelloClanScreen.tsx.
              Every state above is a real response from the same-origin tier.
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ---------- success ----------

interface ClanSuccessProps {
  clan: Awaited<ReturnType<typeof fetchClan>>;
  base: ReturnType<typeof createBaseStyles>;
  styles: ReturnType<typeof createStyles>;
}

function ClanSuccess({ clan, base, styles }: ClanSuccessProps) {
  // The badge is an API icon (07 section 7), rendered through RN Image in a
  // fixed slot so a slow CDN load never reflows the layout.
  const badgeUri = clan.badgeUrls?.medium || clan.badgeUrls?.small;
  return (
    <View style={styles.successWrap}>
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
          <Text style={base.title}>{clan.name}</Text>
          <Text style={styles.tagLine}>{clan.tag}</Text>
        </View>
      </View>

      <View style={styles.chipRow}>
        <StatChip label="Members" value={String(clan.members)} styles={styles} />
        <StatChip label="Clan level" value={String(clan.clanLevel)} styles={styles} />
        <StatChip label="Fetched" value={`${clan.age}s ago`} styles={styles} />
      </View>

      {clan.description ? (
        <Text style={styles.description} numberOfLines={4}>
          {clan.description}
        </Text>
      ) : null}
    </View>
  );
}

interface StatChipProps {
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
}

function StatChip({ label, value, styles }: StatChipProps) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipValue}>{value}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

// ---------- loading ----------

interface ClanSkeletonProps {
  base: ReturnType<typeof createBaseStyles>;
  styles: ReturnType<typeof createStyles>;
}

function ClanSkeleton({ base, styles }: ClanSkeletonProps) {
  // Layout-matched skeleton (06 section 3): same shape as the success state,
  // a pulsing placeholder where the badge, name, tag, and chips will land.
  // No spinner; the layout is the signal that data is on its way.
  return (
    <View style={styles.successWrap} accessibilityRole="progressbar" accessibilityLabel="Loading clan">
      <View style={styles.identity}>
        <View style={[styles.badge, styles.skeletonBlock]} />
        <View style={styles.identityText}>
          <View style={[styles.skeletonLine, styles.skeletonTitle]} />
          <View style={[styles.skeletonLine, styles.skeletonTag]} />
        </View>
      </View>
      <View style={styles.chipRow}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.chip}>
            <View style={[styles.skeletonLine, styles.skeletonChipValue]} />
            <View style={[styles.skeletonLine, styles.skeletonChipLabel]} />
          </View>
        ))}
      </View>
      <View style={[styles.skeletonLine, styles.skeletonDescription]} />
      <Text style={[base.caption, styles.skeletonCaption]}>Fetching through the tier…</Text>
    </View>
  );
}

// ---------- error ----------

interface ClanErrorProps {
  error: ClanFetchError | Error;
  onRetry: () => void;
  isRetrying: boolean;
  base: ReturnType<typeof createBaseStyles>;
  styles: ReturnType<typeof createStyles>;
}

function ClanError({ error, onRetry, isRetrying, base, styles }: ClanErrorProps) {
  // The contract (04 section 6) gives us three real states: not_found,
  // upstream_busy, upstream_unreachable. Each gets its own copy and next
  // action, never a dead end (06 section 3).
  if (error instanceof ClanFetchError) {
    const result = error.result;
    if (result.kind === 'not_found') {
      return (
        <ErrorBody
          tone="gone"
          title="No clan with this tag"
          body={`The hardcoded tag ${HARDCODED_CLAN_TAG} did not resolve. This is a code bug, not a transient failure: the tag was retired or the constant drifted.`}
          action={null}
          base={base}
          styles={styles}
        />
      );
    }
    if (result.kind === 'busy') {
      return (
        <ErrorBody
          tone="busy"
          title="The game API is busy"
          body={`Upstream answered 429. The tier already retried with backoff; trying again in about ${result.retryAfter}s, or hit retry to nudge it.`}
          action={
            <RetryButton
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
    if (result.kind === 'unreachable') {
      return (
        <ErrorBody
          tone="gone"
          title="Can't reach the game API"
          body="The proxy or the game API did not answer. This is usually transient; retry in a moment."
          action={
            <RetryButton
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
  }
  return (
    <ErrorBody
      tone="gone"
      title="Something went wrong"
      body={error.message || 'An unexpected error happened while fetching the clan.'}
      action={
        <RetryButton
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
    <View style={styles.errorWrap} accessibilityRole="alert">
      <View style={[styles.toneDot, tone === 'busy' ? styles.toneBusy : styles.toneGone]} />
      <View style={styles.errorText}>
        <Text style={base.title}>{title}</Text>
        <Text style={base.body}>{body}</Text>
      </View>
      {action ? <View style={styles.errorAction}>{action}</View> : null}
    </View>
  );
}

interface RetryButtonProps {
  label: string;
  onPress: () => void;
  disabled: boolean;
  styles: ReturnType<typeof createStyles>;
}

function RetryButton({ label, onPress, disabled, styles }: RetryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Re-runs the same fetch against the tier."
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.retry,
        pressed && styles.retryPressed,
        disabled && styles.retryDisabled,
      ]}
    >
      <Text style={styles.retryText}>{label}</Text>
    </Pressable>
  );
}

// ---------- styles ----------

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: t.spacing[4],
      marginBottom: t.spacing[7],
    },
    headerText: {
      flex: 1,
      gap: t.spacing[2],
    },
    clanPanel: {
      gap: t.spacing[5],
    },
    successWrap: {
      gap: t.spacing[5],
    },
    identity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing[4],
    },
    identityText: {
      flex: 1,
      gap: t.spacing[1],
    },
    tagLine: {
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.sm,
      color: c.textMuted,
    },
    badge: {
      width: 56,
      height: 56,
      borderRadius: t.radius[3],
      backgroundColor: c.panel,
    },
    badgePlaceholder: {
      width: 56,
      height: 56,
      borderRadius: t.radius[3],
      backgroundColor: c.hairline,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.spacing[3],
    },
    chip: {
      backgroundColor: c.panel,
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorder,
      paddingHorizontal: t.spacing[4],
      paddingVertical: t.spacing[3],
      gap: t.spacing[1],
      minWidth: 120,
    },
    chipValue: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xl,
      fontWeight: t.fontWeight.bold,
      color: c.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    chipLabel: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    description: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.body,
      lineHeight: t.lineHeight.relaxed * t.fontSize.body,
      color: c.textSecondary,
    },
    // skeleton placeholders, kept quiet per the design language: a single
    // accent-soft tone for blocks, a hairline for thin lines.
    skeletonBlock: {
      backgroundColor: c.hairline,
    },
    skeletonLine: {
      backgroundColor: c.hairline,
      borderRadius: t.radius[1],
    },
    skeletonTitle: {
      height: t.fontSize.xl,
      width: 200,
    },
    skeletonTag: {
      height: t.fontSize.sm,
      width: 120,
      marginTop: t.spacing[1],
    },
    skeletonChipValue: {
      height: t.fontSize.xl,
      width: 64,
    },
    skeletonChipLabel: {
      height: t.fontSize.xs,
      width: 80,
      marginTop: t.spacing[1],
    },
    skeletonDescription: {
      height: t.fontSize.body * 2,
      width: '100%',
    },
    skeletonCaption: {
      marginTop: t.spacing[1],
    },
    // error layout: a small tone dot, the message, an optional action.
    errorWrap: {
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
    errorAction: {
      alignSelf: 'flex-end',
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
    retry: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: t.layout.touchTargetMin,
      paddingHorizontal: t.spacing[5],
      paddingVertical: t.spacing[2],
      borderRadius: t.radius.pill,
      backgroundColor: c.accent,
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    retryPressed: {
      backgroundColor: c.accentPressed,
    },
    retryDisabled: {
      opacity: 0.5,
    },
    retryText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.body,
      fontWeight: t.fontWeight.semibold,
      color: c.textOnAccent,
    },
    footer: {
      marginTop: t.spacing[6],
      marginBottom: t.spacing[8],
    },
  });
}
