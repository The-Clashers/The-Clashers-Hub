import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { glassSurfaceFilter, useTheme } from '../theme';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';
import PillButton from './PillButton';
import SkeletonBlock, { useSkeletonPulse } from './SkeletonBlock';
import {
  fetchSearchPage,
  SearchFetchError,
  type SearchClanItem,
} from '../api/search';
import { busyRetryDelayMs, shouldRetryBusy } from '../lib/busy-retry';

// The clan pop up search bar (T-M3-4, the compare landing's clan mode).
//
// The game API has no player search by name, which is why the player
// compare is tag-only. Clans are the flexible ones (F-01): a clan name
// searches. But a comparison needs two exact clans, and a name alone
// matches many, so the landing's clan mode opens this picker instead of
// guessing: type a name, see the same result rows the search screen
// shows, tap the right clan, and its #TAG lands in the side's input box.
// A visitor who already knows the tag never meets this popup; the input
// box takes #TAG directly, exactly as before.
//
// The dialog mechanics follow the Dropdown's own (07's no-DOM-libraries
// rule): a portal at document.body with position:fixed and the overlay
// z-index, because react-native-web gives every View its own stacking
// context and an in-tree panel can never climb over a later sibling.
// Escape and an outside press close it; focus lands on the search input
// when it opens and returns to the element that opened it when it
// closes. The press-outside listener is document-level, the resize
// lesson the Dropdown learned does not apply (the dialog is centered,
// never anchored to a trigger).
//
// One page of results (30, SEARCH_PAGE_LIMIT): a picker is a
// disambiguation, not a browsing surface; the empty state teaches
// refining the name instead of paginating past the clan the visitor
// actually wants.

// The search client's own staleTime (60 s, the tier's search TTL), so a
// name the visitor just searched on /clans answers from the shared
// cache: the query key matches the search screen's shape.
const SEARCH_STALE_TIME_MS = 60_000;

// How tall the results list may grow before it scrolls; a longer list is
// honest scrollbar territory (the row count ceiling is the page limit).
const RESULTS_MAX_HEIGHT = 320;

export interface ClanSearchPopupProps {
  /** True while the picker should render. */
  visible: boolean;
  /** Which side the pick lands in, e.g. "First clan": the title and the
   * pick label both read it. */
  sideLabel: string;
  /** The seed query: whatever the visitor already typed in the side's
   * input box, searched immediately when the popup opens with a valid
   * name in it. */
  initialQuery: string;
  /** Fires with the picked clan; the parent fills its input with the tag. */
  onPick: (clan: SearchClanItem) => void;
  onClose: () => void;
}

export default function ClanSearchPopup({
  visible,
  sideLabel,
  initialQuery,
  onPick,
  onClose,
}: ClanSearchPopupProps) {
  const { theme } = useTheme();
  const overlayStyles = useMemo(() => createOverlayStyles(theme), [theme]);

  // The draft starts from the seed and searches on submit (Enter or the
  // Search button), the apply-on-submit rhythm every search box keeps.
  const [draft, setDraft] = useState(initialQuery);
  const [submitted, setSubmitted] = useState<string | null>(
    initialQuery.trim().length >= 3 ? initialQuery.trim() : null,
  );

  // The input's focus target and the element to return focus to on
  // close, both resolved through nativeID + getElementById (the
  // Dropdown's own trick: refs on View fight the RN 0.88 types).
  const inputId = 'clan-picker-input';
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const trimmed = draft.trim();
  const nameTooShort = trimmed.length > 0 && trimmed.length < 3;

  // Every effect is mount-guarded on visible so a closed popup listens
  // to nothing.
  useEffect(() => {
    if (!visible) return;
    // Seed the draft once per open, not on every parent re-render.
    setDraft(initialQuery);
    setSubmitted(initialQuery.trim().length >= 3 ? initialQuery.trim() : null);
    restoreFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const node = document.getElementById(inputId);
    node?.focus();
  }, [visible, initialQuery]);

  // Escape closes, wherever focus sits inside the dialog. The listener
  // registers in the capture phase: the dialog's own TextInput stops
  // keydown propagation at the target (react-native-web's input
  // handling), so a bubble-phase document listener never sees Escape
  // while focus rests in the search box, which is the dialog's own
  // opening state (the effect below focuses it on open). Capture runs
  // before the target's handlers, so the close fires either way.
  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [visible, onClose]);

  // An outside press closes. mousedown, not click: the dialog should be
  // gone before the press lands on whatever sits underneath it.
  useEffect(() => {
    if (!visible) return;
    const onPointerDown = (event: MouseEvent) => {
      const dialog = document.getElementById('clan-picker-dialog');
      if (
        event.target instanceof Node &&
        !dialog?.contains(event.target)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [visible, onClose]);

  // Return focus to the opener on close, the Dropdown's contract.
  useEffect(() => {
    if (visible) return;
    restoreFocusRef.current?.focus();
    restoreFocusRef.current = null;
  }, [visible]);

  if (!visible) return null;

  return createPortal(
    <View style={overlayStyles.overlay} nativeID="clan-picker-dialog">
      <PickerDialog
        sideLabel={sideLabel}
        draft={draft}
        setDraft={setDraft}
        submitted={submitted}
        setSubmitted={setSubmitted}
        nameTooShort={nameTooShort}
        inputId={inputId}
        onPick={onPick}
        onClose={onClose}
      />
    </View>,
    document.body,
  );
}

// ---------- the dialog ----------

interface PickerDialogProps {
  sideLabel: string;
  draft: string;
  setDraft: (value: string) => void;
  submitted: string | null;
  setSubmitted: (value: string | null) => void;
  nameTooShort: boolean;
  inputId: string;
  onPick: (clan: SearchClanItem) => void;
  onClose: () => void;
}

function PickerDialog({
  sideLabel,
  draft,
  setDraft,
  submitted,
  setSubmitted,
  nameTooShort,
  inputId,
  onPick,
  onClose,
}: PickerDialogProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // One page, the search screen's own key and retry policy: the busy
  // outcome paces itself through lib/busy-retry, a bad request stops
  // (the three-character floor already taught inline), everything else
  // one retry.
  const query = useQuery({
    queryKey: ['search', { name: submitted }] as const,
    queryFn: () => fetchSearchPage({ name: submitted as string }),
    enabled: submitted !== null,
    staleTime: SEARCH_STALE_TIME_MS,
    retry: (failureCount, error) => {
      if (error instanceof SearchFetchError) {
        if (error.result.kind === 'bad_request') return false;
        if (error.result.kind === 'busy') return shouldRetryBusy(failureCount);
      }
      return failureCount < 1;
    },
    retryDelay: (failureCount, error) => {
      if (error instanceof SearchFetchError && error.result.kind === 'busy') {
        return busyRetryDelayMs(error.result.retryAfter, failureCount);
      }
      return 1_000;
    },
  });

  const busyRetrying =
    query.isPending &&
    query.failureReason instanceof SearchFetchError &&
    query.failureReason.result.kind === 'busy';

  const submit = () => {
    const trimmed = draft.trim();
    if (trimmed.length >= 3) setSubmitted(trimmed);
  };

  return (
    <View
      style={styles.dialog}
      accessibilityRole="dialog"
      aria-modal={true}
      aria-label={`Find a clan for the ${sideLabel} side`}
    >
      <View style={styles.titleRow}>
        <View style={styles.titleText}>
          <Text style={styles.title}>Find a clan</Text>
          <Text style={styles.subtitle}>
            {`For the ${sideLabel.toLowerCase()} side. Search by name, tap the clan you mean.`}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close the clan picker"
          onPress={onClose}
          style={({ pressed }) => [styles.closeButton, pressed && styles.closePressed]}
        >
          <Text style={styles.closeMark} aria-hidden>
            {'\u00d7'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.inputWrap}>
          <TextInput
            nativeID={inputId}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={submit}
            placeholder="Clan name, at least three characters"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={64}
            style={styles.textInput}
            accessibilityLabel="Clan name search"
          />
        </View>
        <PillButton label="Search" icon="search" onPress={submit} />
      </View>
      <Text style={nameTooShort ? styles.hintWarn : styles.hint}>
        {nameTooShort
          ? 'Clan names need at least three characters.'
          : 'Or close this and paste a #tag into the box.'}
      </Text>

      <View style={styles.results}>
        {query.isPending ? (
          <ResultsLoading busyRetrying={busyRetrying} />
        ) : query.isError ? (
          <SearchError
            error={query.error as SearchFetchError | Error}
            onRetry={() => void query.refetch()}
            isRetrying={query.isFetching}
          />
        ) : query.data!.items.length === 0 ? (
          <EmptyState
            title="No clans match this name"
            body="The game API found nothing for that name. Check the spelling, or search a shorter part of the name."
          />
        ) : (
          query.data!.items.map((clan) => (
            <ClanPickRow key={clan.tag} clan={clan} onPick={onPick} />
          ))
        )}
      </View>
      {query.isSuccess && query.data!.items.length > 0 ? (
        <Text style={styles.footNote}>
          {`${query.data!.items.length} shown. Refine the name if the clan you want is not here.`}
        </Text>
      ) : null}
    </View>
  );
}

// ---------- one pickable result row ----------

interface ClanPickRowProps {
  clan: SearchClanItem;
  onPick: (clan: SearchClanItem) => void;
}

function ClanPickRow({ clan, onPick }: ClanPickRowProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const badgeUri = clan.badgeUrls?.medium || clan.badgeUrls?.small;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${clan.name}, level ${clan.clanLevel}, ${clan.members} members${
        clan.locationName ? `, ${clan.locationName}` : ''
      }. Use this clan.`}
      onPress={() => onPick(clan)}
      style={({ pressed }) => [styles.resultRow, pressed && styles.resultPressed]}
    >
      {badgeUri ? (
        <Image
          source={{ uri: badgeUri }}
          style={styles.resultBadge}
          accessibilityLabel={`${clan.name} clan badge`}
        />
      ) : (
        <View style={[styles.resultBadge, styles.resultBadgeEmpty]} />
      )}
      <View style={styles.resultBody}>
        <View style={styles.resultTitleRow}>
          <Text style={styles.resultName} numberOfLines={1}>
            {clan.name}
          </Text>
          <Text style={styles.resultTag} numberOfLines={1}>
            {clan.tag}
          </Text>
        </View>
        <Text style={styles.resultMeta} numberOfLines={1}>
          {`Level ${clan.clanLevel} · ${clan.members} members${
            clan.locationName ? ` · ${clan.locationName}` : ''
          }`}
        </Text>
      </View>
    </Pressable>
  );
}

// ---------- loading ----------

function ResultsLoading({ busyRetrying }: { busyRetrying: boolean }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const pulse = useSkeletonPulse();

  return (
    <View
      style={styles.loadingColumn}
      accessibilityRole="progressbar"
      accessibilityLabel="Searching clans"
    >
      {[0, 1, 2, 3].map((row) => (
        <View key={row} style={styles.loadingRow}>
          <SkeletonBlock width={24} height={24} pulse={pulse} radiusStep={1} />
          <View style={styles.sideIdentityText}>
            <SkeletonBlock width={140} height={theme.fontSize.sm} pulse={pulse} />
            <SkeletonBlock width={200} height={theme.fontSize.xs} pulse={pulse} />
          </View>
        </View>
      ))}
      {busyRetrying ? (
        <Text style={styles.loadingCaption}>
          The game API is busy. One moment, retrying automatically…
        </Text>
      ) : null}
    </View>
  );
}

// ---------- error (the search contract's own copy) ----------

interface SearchErrorProps {
  error: SearchFetchError | Error;
  onRetry: () => void;
  isRetrying: boolean;
}

function SearchError({ error, onRetry, isRetrying }: SearchErrorProps) {
  // The contract (04 section 6) hands search three states; the copy is
  // the search screen's own, so the two surfaces never disagree about
  // the same failure.
  if (error instanceof SearchFetchError && error.result.kind === 'busy') {
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
  if (error instanceof SearchFetchError && error.result.kind === 'unreachable') {
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
      title="The search did not go through"
      body="The tier rejected the search. Retry in a moment; if it keeps happening, a shorter name usually helps."
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

// ---------- styles ----------

/** The body-level overlay: a fixed veil over the page with the dialog
 * centered on it, at the overlay z-index (the Dropdown's own layer). */
function createOverlayStyles(t: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    overlay: {
      position: 'fixed' as unknown as 'relative',
      zIndex: t.zIndex.overlay,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.canvasVeil,
      paddingHorizontal: t.layout.sidePaddingMobile,
    },
  });
}

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    dialog: {
      width: '100%',
      maxWidth: 560,
      gap: t.spacing[3],
      padding: t.spacing[4],
      borderRadius: t.radius[3],
      borderWidth: 1,
      borderColor: c.panelBorderStrong,
      borderTopColor: c.panelHighlight,
      backgroundColor: c.panelRaised,
      ...glassSurfaceFilter(t),
      shadowColor: c.shadowColor,
      ...t.shadows.lifted,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      columnGap: t.spacing[3],
    },
    titleText: {
      flex: 1,
      gap: t.spacing[1],
    },
    title: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.lg,
      fontWeight: t.fontWeight.bold,
      color: c.textPrimary,
    },
    subtitle: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textSecondary,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.fillQuiet,
      borderWidth: 1,
      borderColor: c.panelBorder,
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    closePressed: {
      backgroundColor: c.panel,
    },
    // The close mark: a plain multiplication sign drawn as text, so it
    // stays crisp at any zoom and costs no glyph.
    closeMark: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.lg,
      fontWeight: t.fontWeight.bold,
      color: c.textSecondary,
      lineHeight: t.lineHeight.tight * t.fontSize.lg,
    },

    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: t.spacing[2],
    },
    inputWrap: {
      flex: 1,
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorderStrong,
      borderTopColor: c.panelHighlight,
      backgroundColor: c.panel,
    },
    textInput: {
      minHeight: t.layout.controlHeight,
      paddingHorizontal: t.spacing[3],
      paddingVertical: t.spacing[2],
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textPrimary,
      outlineColor: c.focusRing,
    },
    hint: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      color: c.textMuted,
    },
    hintWarn: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      color: c.warning,
    },

    // The results list: capped height with scroll, the ClanCard row
    // family (badge slot, name + tag, meta line).
    results: {
      gap: t.spacing[1],
      maxHeight: RESULTS_MAX_HEIGHT,
      overflow: 'scroll' as unknown as 'visible',
    },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing[3],
      padding: t.spacing[2],
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorder,
      borderTopColor: c.panelHighlight,
      backgroundColor: c.panelRaised,
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    resultPressed: {
      backgroundColor: c.panel,
      borderColor: c.accent,
    },
    resultBadge: {
      width: 24,
      height: 24,
      borderRadius: t.radius[1],
      backgroundColor: c.panel,
    },
    resultBadgeEmpty: {
      backgroundColor: c.hairline,
    },
    resultBody: {
      flex: 1,
      minWidth: 0,
      gap: t.spacing[1],
    },
    resultTitleRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      columnGap: t.spacing[2],
    },
    resultName: {
      flexShrink: 1,
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
    },
    resultTag: {
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.xs,
      color: c.textMuted,
    },
    resultMeta: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      color: c.textSecondary,
    },

    loadingColumn: {
      gap: t.spacing[2],
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing[3],
      padding: t.spacing[2],
    },
    sideIdentityText: {
      flex: 1,
      gap: t.spacing[1],
    },
    loadingCaption: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      color: c.textMuted,
    },
    footNote: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      color: c.textMuted,
    },
  });
}
