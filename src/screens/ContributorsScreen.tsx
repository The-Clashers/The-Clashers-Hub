import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTheme, createBaseStyles } from '../theme';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import PillButton from '../components/PillButton';
import SkeletonBlock, { useSkeletonPulse } from '../components/SkeletonBlock';
import {
  CONTRIBUTORS_REPO_URL,
  ContributorsFetchError,
  fetchContributors,
  type Contributor,
} from '../api/contributors';

// The contributors page (the owner's nav revision): credits the people
// who built the repo, read live from GitHub's public API (see
// api/contributors.ts for why that call is safe to make from the browser).
// The list is ordered by contributions, which is the order GitHub already
// returns; no re-sorting, no ranking of our own.
//
// The state matrix is the same four states every screen designs (06
// section 3): skeleton rows while loading, the rate-limit branch with its
// own honest copy (the one failure mode a public, unauthenticated
// endpoint really has), the unreachable branch with a retry, and the
// success list. An empty list is a real answer and gets the empty state.
//
// The design token review (/tokens) moved here from the search screen's
// retired M0 footer (the owner's call): it is a maintainer QA surface,
// so it renders as a quiet footnote link under the list rather than a
// button competing with the page's content.

// Enough skeleton rows to fill the fold without implying a count.
const SKELETON_ROWS = 5;

// The avatar slot: a fixed box so a slow CDN load never reflows the row
// (the same rule the badge and league icons follow, 07 section 7).
const AVATAR_SLOT = 40;

export default function ContributorsScreen() {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigate = useNavigate();

  const query = useQuery({
    queryKey: ['contributors'] as const,
    queryFn: () => fetchContributors(),
    // Five minutes: the list changes with merges, not minutes, and the
    // page revisit cost is one request against a 60/hour budget.
    staleTime: 300_000,
    retry: (failureCount, error) => {
      // Rate limiting does not clear inside a visit; retrying burns the
      // budget. Everything else gets the single default retry.
      if (error instanceof ContributorsFetchError && error.result.kind === 'rate_limited') {
        return false;
      }
      return failureCount < 1;
    },
  });

  return (
    <View style={base.appRoot}>
      <View style={base.screen}>
        <View style={[base.contentColumn, styles.column]}>
          <View style={styles.header}>
            <Text style={base.display}>Contributors</Text>
            <Text style={base.subtitle}>
              The people building The Clashers Hub, read live from the repository.
            </Text>
          </View>

          {query.isPending ? (
            <ContributorsLoading />
          ) : query.isError ? (
            <View style={base.statePanel}>
              <ContributorsError
                error={query.error as ContributorsFetchError | Error}
                onRetry={() => void query.refetch()}
                isRetrying={query.isFetching}
              />
            </View>
          ) : query.data.length === 0 ? (
            <View style={base.statePanel}>
              <EmptyState
                title="No contributors yet"
                body="The repository has no attributed commits so far. Check back after the first merge."
                action={
                  <PillButton
                    label="Visit the repo"
                    role="link"
                    arrow
                    onPress={() => window.open(CONTRIBUTORS_REPO_URL, '_blank', 'noopener')}
                    hint="Opens the GitHub repository in a new tab."
                  />
                }
              />
            </View>
          ) : (
            <View style={base.panelRaised} accessibilityLabel="Contributor list">
              {query.data.map((contributor, index) => (
                <ContributorRow
                  key={contributor.login}
                  contributor={contributor}
                  isLast={index === query.data.length - 1}
                />
              ))}
              <Text style={styles.listFooter}>
                {query.data.length} contributor{query.data.length === 1 ? '' : 's'}
              </Text>
            </View>
          )}

          {/* The token review's new home (the owner's call): a quiet
              footnote link, present in every state, because it is a
              maintainer surface rather than a visitor action. */}
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Design token review"
            accessibilityHint="Opens the design token review surface."
            onPress={() => navigate('/tokens')}
            style={({ pressed }) => [styles.qaLink, pressed && styles.qaLinkPressed]}
          >
            <Text style={styles.qaLinkText}>
              Design token review {'\u2192'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ---------- one contributor row ----------

function ContributorRow({
  contributor,
  isLast,
}: {
  contributor: Contributor;
  isLast: boolean;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createRowStyles(theme), [theme]);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${contributor.login}, ${contributor.contributions} contributions`}
      accessibilityHint="Opens the contributor's GitHub profile in a new tab."
      onPress={() => window.open(contributor.profileUrl, '_blank', 'noopener')}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed, isLast && styles.rowLast]}
    >
      {contributor.avatarUrl ? (
        <Image
          source={{ uri: contributor.avatarUrl }}
          style={styles.avatar}
          accessibilityLabel={`${contributor.login} avatar`}
        />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Text style={styles.avatarInitial}>{contributor.login.slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.text}>
        <Text style={styles.login} numberOfLines={1}>
          {contributor.login}
        </Text>
        <Text style={styles.contributions}>
          {contributor.contributions} contribution{contributor.contributions === 1 ? '' : 's'}
        </Text>
      </View>
      <Text style={styles.openHint} aria-hidden>
        GitHub {'\u2192'}
      </Text>
    </Pressable>
  );
}

// ---------- loading ----------

function ContributorsLoading() {
  const { theme } = useTheme();
  const styles = useMemo(() => createRowStyles(theme), [theme]);
  const pulse = useSkeletonPulse();
  return (
    <View
      style={styles.skeletonWrap}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading contributors"
    >
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <View key={index} style={styles.skeletonRow}>
          <SkeletonBlock width={AVATAR_SLOT} height={AVATAR_SLOT} radiusStep="pill" pulse={pulse} />
          <View style={styles.skeletonText}>
            <SkeletonBlock width="46%" height={theme.fontSize.md} pulse={pulse} />
            <SkeletonBlock width="28%" height={theme.fontSize.xs} pulse={pulse} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ---------- error ----------

function ContributorsError({
  error,
  onRetry,
  isRetrying,
}: {
  error: ContributorsFetchError | Error;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  if (error instanceof ContributorsFetchError && error.result.kind === 'rate_limited') {
    const wait =
      error.result.retryAfterSeconds !== undefined && error.result.retryAfterSeconds > 0
        ? ` Try again in about ${Math.ceil(error.result.retryAfterSeconds / 60)} minute${
            Math.ceil(error.result.retryAfterSeconds / 60) === 1 ? '' : 's'
          }.`
        : '';
    return (
      <ErrorState
        tone="busy"
        title="GitHub is rate-limiting this browser"
        body={`The public contributors endpoint allows a fixed number of requests per hour, and this one is spent.${wait} The page will work again on its own.`}
      />
    );
  }
  return (
    <ErrorState
      tone="gone"
      title="Can't reach GitHub"
      body="The contributors list did not load. This is usually transient; retry in a moment."
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
    header: {
      gap: t.spacing[2],
      marginBottom: t.spacing[6],
    },
    listFooter: {
      marginTop: t.spacing[3],
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textMuted,
      fontVariant: ['tabular-nums'],
    },
    // The QA footnote link: muted text with the kit's arrow, not a pill
    // button, so it reads as fine print under the content instead of an
    // action competing with it. The gold focus ring still applies.
    qaLink: {
      alignSelf: 'flex-start',
      marginTop: t.spacing[4],
      paddingVertical: t.spacing[1],
      borderRadius: t.radius[1],
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    qaLinkPressed: {
      opacity: 0.7,
    },
    qaLinkText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textMuted,
    },
  });
}

function createRowStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing[4],
      paddingVertical: t.spacing[3],
      borderBottomWidth: 1,
      borderBottomColor: c.hairline,
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    rowLast: {
      borderBottomWidth: 0,
    },
    rowPressed: {
      opacity: 0.7,
    },
    avatar: {
      width: AVATAR_SLOT,
      height: AVATAR_SLOT,
      borderRadius: 9999,
    },
    avatarPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.panel,
      borderWidth: 1,
      borderColor: c.panelBorder,
    },
    avatarInitial: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.md,
      fontWeight: t.fontWeight.semibold,
      color: c.textSecondary,
    },
    text: {
      flex: 1,
      minWidth: 0,
      gap: t.spacing[1],
    },
    login: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.md,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
    },
    contributions: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textMuted,
      fontVariant: ['tabular-nums'],
    },
    openHint: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      color: c.textMuted,
    },
    skeletonWrap: {
      gap: t.spacing[3],
    },
    skeletonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing[4],
      paddingVertical: t.spacing[2],
    },
    skeletonText: {
      flex: 1,
      gap: t.spacing[2],
    },
  });
}
