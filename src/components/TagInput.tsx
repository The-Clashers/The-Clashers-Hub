import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigate } from 'react-router';
import { useTheme, createBaseStyles } from '../theme';
import Dropdown, { type DropdownOption } from './Dropdown';
import {
  lookupRouteFor,
  normalizeTagInput,
  type NormalizeTagResult,
  type TagLookupTarget,
} from '../lib/tag';

// The tag lookup box (T-M1-2, FR-02, SR-13). The ONE component that owns
// tag normalization: it accepts a tag with or without the # prefix, runs
// the rule from src/lib/tag.ts (uppercase, prepend #, validate), and
// routes to the detail screen of whichever target its dropdown selected,
// /player/:tag or /clan/:tag, with the tag URL-encoded. No other component
// does normalization; the rule itself lives in lib/tag.ts so it is
// unit-testable without rendering React.
//
// The target dropdown exists because the game API draws a hard line the UI
// must not blur: there is no player search by name, so a player is
// reachable by tag only, while a clan is reachable both by name (the
// search bar above) and by tag (this box). The dropdown defaults to
// Player, which keeps golden path B exactly what it was: paste a tag,
// press Go, land on the player. Selecting Clan points the same box at
// /clan/:tag.
//
// The box is purely client-side: no fetch happens here. The player and
// clan screens own their fetches (and the four state-matrix states that
// come with them).

/** The two things the box can look up. Labels are short because the
 * dropdown trigger sits in the label row, not the input row. */
const TARGET_OPTIONS: ReadonlyArray<DropdownOption<TagLookupTarget>> = [
  { value: 'player', label: 'Player' },
  { value: 'clan', label: 'Clan' },
];

/** Per-target copy. Sentences live here so the wording stays consistent
 * and the target switch rewrites the whole box in one lookup. The
 * placeholder is shared and kept short on purpose: the input is 242 px
 * wide at the 360 px compatibility floor (NFR-05) and a longer sentence
 * truncates mid-word there; the accessibility hint carries the full
 * instruction instead. */
const PLACEHOLDER = 'Paste a tag, # optional';

const TARGET_COPY: Record<
  TagLookupTarget,
  {
    inputLabel: string;
    inputHint: string;
    empty: string;
    buttonLabel: string;
    buttonHint: string;
    footnote: string;
  }
> = {
  player: {
    inputLabel: 'Player tag',
    inputHint: 'Paste a player tag and press Go. The # prefix is optional.',
    empty: 'Type a player tag first.',
    buttonLabel: 'Look up player',
    buttonHint: 'Normalizes the tag and opens the player detail screen.',
    footnote: 'Player tag shortcut, golden path B.',
  },
  clan: {
    inputLabel: 'Clan tag',
    inputHint: 'Paste a clan tag and press Go. The # prefix is optional.',
    empty: 'Type a clan tag first.',
    buttonLabel: 'Look up clan',
    buttonHint: 'Normalizes the tag and opens the clan detail screen.',
    footnote: 'Clan tag shortcut, opens the clan directly.',
  },
};

/** The reject reasons the normalizer can produce. */
type TagRejectReason = Exclude<NormalizeTagResult, { ok: true }>['reason'];

/** Reason copy that does not depend on the target. The empty case does,
 * so it lives in TARGET_COPY and this table skips it. */
const REASON_COPY: Record<Exclude<TagRejectReason, 'empty'>, string> = {
  too_short: 'Tags are at least three characters.',
  too_long: 'Tags are at most twenty characters.',
  bad_chars: 'Tags use letters and numbers only.',
};

function reasonCopy(target: TagLookupTarget, reason: TagRejectReason): string {
  if (reason === 'empty') return TARGET_COPY[target].empty;
  return REASON_COPY[reason];
}

export interface TagInputProps {
  /** Optional caption shown left of the target dropdown; defaults to "Look up by tag". */
  label?: string;
  /** Override navigation in tests; defaults to react-router's useNavigate. */
  onNavigate?: (route: string) => void;
  /** Optional children rendered after the input row (e.g. a hint). */
  children?: ReactNode;
}

export default function TagInput({ label = 'Look up by tag', onNavigate, children }: TagInputProps) {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigate = useNavigate();
  const go = onNavigate ?? ((route: string) => navigate(route));

  const [target, setTarget] = useState<TagLookupTarget>('player');
  const [draft, setDraft] = useState('');
  const [result, setResult] = useState<NormalizeTagResult>({ ok: false, reason: 'empty' });
  const [touched, setTouched] = useState(false);

  const copy = TARGET_COPY[target];

  const submit = () => {
    setTouched(true);
    const next = normalizeTagInput(draft);
    setResult(next);
    if (next.ok) {
      go(lookupRouteFor(target, next.tag));
    }
  };

  // Clear the validation hint as soon as the user fixes whatever was wrong,
  // so the box does not nag between keystrokes. The next submit re-runs the
  // rule and re-shows a hint if the input is still invalid. Switching the
  // target does not clear anything: the tag alphabet is shared, so a draft
  // that was invalid for a player is invalid for a clan too.
  const handleChange = (text: string) => {
    setDraft(text);
    if (!touched) return;
    const recheck = normalizeTagInput(text);
    // Only update if the reason changed (or the input became valid): avoids
    // a re-render on every keystroke that does not change the verdict.
    const currentReason = result.ok ? 'ok' : result.reason;
    const nextReason = recheck.ok ? 'ok' : recheck.reason;
    if (nextReason !== currentReason) {
      setResult(recheck);
    }
  };

  // `touched` alone gates the hint: before the first submit the box stays
  // quiet, after a rejected submit every reason shows, empty included. That
  // mirrors the name input one panel up ("Type a clan name first.") so both
  // inputs on the entry route behave the same.
  const showError = !result.ok && touched;
  const remaining = 21 - draft.length; // '#' + 20 max

  return (
    <View style={styles.wrap} accessibilityRole="search">
      <View style={styles.targetRow}>
        <Text style={styles.label}>{label}</Text>
        <Dropdown
          label="Look up"
          hideLabel
          options={TARGET_OPTIONS}
          value={target}
          onSelect={setTarget}
        />
      </View>
      <View style={styles.row}>
        <TextInput
          value={draft}
          onChangeText={handleChange}
          onSubmitEditing={submit}
          placeholder={PLACEHOLDER}
          placeholderTextColor={theme.colors.textMuted}
          accessibilityLabel={copy.inputLabel}
          accessibilityHint={copy.inputHint}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={21}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.buttonLabel}
          accessibilityHint={copy.buttonHint}
          onPress={submit}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>Go</Text>
        </Pressable>
      </View>
      {showError ? (
        <Text style={styles.error} accessibilityRole="alert">
          {reasonCopy(target, result.reason)}
        </Text>
      ) : null}
      <View style={styles.footnoteRow}>
        <Text style={base.caption}>{copy.footnote}</Text>
        {/* The counter only speaks near the ceiling. Real tags are 3 to 9
            characters, so an always-on countdown is noise; ten from the
            limit it becomes useful. */}
        {remaining <= 10 ? (
          <Text style={styles.counter}>{remaining} left</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

// ---------- styles ----------

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    wrap: {
      gap: t.spacing[2],
    },
    // The label row: what the box does on the left, which tag kind it wants
    // on the right. The dropdown is the method selector, so it sits with the
    // label, above the input row it governs.
    targetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: t.spacing[3],
    },
    label: {
      flexShrink: 1,
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    row: {
      flexDirection: 'row',
      gap: t.spacing[3],
      alignItems: 'stretch',
    },
    input: {
      flex: 1,
      minHeight: t.layout.touchTargetMin,
      paddingHorizontal: t.spacing[4],
      paddingVertical: t.spacing[2],
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorderStrong,
      backgroundColor: c.panelRaised,
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.md,
      color: c.textPrimary,
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    button: {
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
    buttonPressed: {
      backgroundColor: c.accentPressed,
    },
    buttonText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.body,
      fontWeight: t.fontWeight.semibold,
      color: c.textOnAccent,
    },
    error: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.warning,
    },
    footnoteRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: t.spacing[3],
    },
    counter: {
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.xs,
      color: c.textMuted,
      fontVariant: ['tabular-nums'],
    },
  });
}
