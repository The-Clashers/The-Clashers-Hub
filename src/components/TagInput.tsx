import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigate } from 'react-router';
import { useTheme, createBaseStyles } from '../theme';
import { normalizeTagInput, playerRouteFor, type NormalizeTagResult } from '../lib/tag';

// The tag lookup box (T-M1-2, FR-02, SR-13). The ONE component that owns
// tag normalization: it accepts a tag with or without the # prefix, runs
// the rule from src/lib/tag.ts (uppercase, prepend #, validate), and
// routes to /player/:tag with the tag URL-encoded. No other component
// does normalization; the rule itself lives in lib/tag.ts so it is
// unit-testable without rendering React.
//
// The box sits on the search screen today, where the URL map puts it
// (docs/concept/03-features-list.md section 2: the entry route is search,
// filter row, recent searches, tag-lookup box). When F-13 (recent
// searches) lands, the box stays the owner of normalization; the recent
// list just feeds it tags.
//
// The box is purely client-side: no fetch happens here. The player screen
// owns the fetch (and the four state-matrix states that come with it).

/** The reason keys the UI surfaces next to the input. Sentences live here
 * so the wording stays consistent and the unit test can assert the key. */
const REASON_COPY: Record<Exclude<NormalizeTagResult, { ok: true }>['reason'], string> = {
  empty: 'Type a player tag first.',
  too_short: 'Tags are at least three characters.',
  too_long: 'Tags are at most twenty characters.',
  bad_chars: 'Tags use letters and numbers only.',
};

export interface TagInputProps {
  /** Optional caption shown above the input; defaults to "Player tag". */
  label?: string;
  /** Override navigation in tests; defaults to react-router's useNavigate. */
  onNavigate?: (route: string) => void;
  /** Optional children rendered after the input row (e.g. a hint). */
  children?: ReactNode;
}

export default function TagInput({ label = 'Player tag', onNavigate, children }: TagInputProps) {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigate = useNavigate();
  const go = onNavigate ?? ((route: string) => navigate(route));

  const [draft, setDraft] = useState('');
  const [result, setResult] = useState<NormalizeTagResult>({ ok: false, reason: 'empty' });
  const [touched, setTouched] = useState(false);

  const submit = () => {
    setTouched(true);
    const next = normalizeTagInput(draft);
    setResult(next);
    if (next.ok) {
      go(playerRouteFor(next.tag));
    }
  };

  // Clear the validation hint as soon as the user fixes whatever was wrong,
  // so the box does not nag between keystrokes. The next submit re-runs the
  // rule and re-shows a hint if the input is still invalid.
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

  const showError = !result.ok && touched && result.reason !== 'empty';
  const remaining = 21 - draft.length; // '#' + 20 max

  return (
    <View style={styles.wrap} accessibilityRole="search">
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <TextInput
          value={draft}
          onChangeText={handleChange}
          onSubmitEditing={submit}
          placeholder="Paste a player tag, with or without #"
          placeholderTextColor={theme.colors.textMuted}
          accessibilityLabel="Player tag"
          accessibilityHint="Paste a player tag and press Go. The # prefix is optional."
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={21}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Look up player"
          accessibilityHint="Normalizes the tag and opens the player detail screen."
          onPress={submit}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>Go</Text>
        </Pressable>
      </View>
      {showError ? (
        <Text style={styles.error} accessibilityRole="alert">
          {REASON_COPY[result.reason]}
        </Text>
      ) : null}
      <View style={styles.footnoteRow}>
        <Text style={base.caption}>Tag-lookup shortcut, golden path B.</Text>
        <Text style={styles.counter}>{remaining}</Text>
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
    label: {
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
